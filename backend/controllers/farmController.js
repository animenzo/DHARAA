const Farm = require('../models/Farm');
const Device = require('../models/Device');
const { provisionDeviceForFarm } = require('../services/provisioningService');
const getSeason = require('../utils/getSeason');
const CropFinalDataset = require('../models/CropFinalDataset');
const SoilDataset = require('../models/SoilDataset');
const { generateAndStoreForFarm } = require('../services/smartIrrigationFarmSyncService');
const { calculateTankCapacityLiters } = require('../utils/tankCalculations');

const createFarm = async (req, res) => {
    try {
        // 1. Get data from frontend form
        const {
            name,
            farmShape,
            farmDimensions,
            location,
            current_crop,
            coordinates,
            tankDetails,
            soilType,
            irrigationMethod,
            dateOfSowing,
            mobileNumber,
            pincode,
            deviceId
        } = req.body;

        if (
            !name ||
            !farmShape ||
            !current_crop ||
            !soilType ||
            !irrigationMethod ||
            !dateOfSowing ||
            !mobileNumber ||
            !deviceId
        ) {
            return res.status(400).json({
                message: 'Please add all required fields'
            });
        }

        // 2. Create the farm and link it to the logged-in user (req.user.id)
        const farm = await Farm.create({
            user: req.user.id,
            name,
            farmShape,
            farmDimensions,
            location,
            current_crop,
            coordinates,
            tankDetails,
            soilType,
            irrigationMethod,
            dateOfSowing,
            mobileNumber,
            pincode
        });

        // 3. Provision the device for this farm (1:1).
        //    If deviceId is already taken, roll back the farm we just created
        //    so we don't leave an orphaned, device-less farm in the DB.
        let provisioning;
        try {
            provisioning = await provisionDeviceForFarm(req.user, farm, deviceId);
        } catch (provErr) {
            await Farm.findByIdAndDelete(farm._id);
            return res.status(409).json({ message: provErr.message });
        }

        let smartIrrigation = null;
        try {
            smartIrrigation = await generateAndStoreForFarm({
                farmId: farm._id,
                deviceId: provisioning.device.deviceId
            });
        } catch (smartErr) {
            console.error(
                '[farmController] Smart irrigation generation failed:',
                smartErr.message
            );
            smartIrrigation = {
                warning: 'Farm created, but smart irrigation data was not generated.',
                error: smartErr.message
            };
        }

        res.status(201).json({
            farm,
            device: {
                deviceId: provisioning.device.deviceId,
                topics: provisioning.device.topics,
                
            },
            smartIrrigation,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all farms for the logged-in user
// @route   GET /api/farms
// @access  Private
const getMyFarms = async (req, res) => {
    try {
        // Find farms where the 'user' field matches the logged-in user's ID
        const farms = await Farm.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .populate('device', 'deviceId name status lastSeen isActive hardwareType topics')
            .populate('current_crop')
            .populate('soilType');
        res.status(200).json(farms);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get a single farm by ID
// @route   GET /api/farms/:id
// @access  Private
const getFarmById = async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id)
            .populate('device', 'deviceId name status lastSeen isActive hardwareType topics')
            .populate('current_crop')
            .populate('soilType');

        if (!farm) {
            return res.status(404).json({ message: 'Farm not found' });
        }

        // Security Check: Ensure the user accessing the farm actually owns it
        if (farm.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        res.status(200).json(farm);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update farm details
// @route   PUT /api/farms/:id
// @access  Private
// @desc    Update farm details
// @route   PUT /api/farms/:id
// @access  Private

const updateFarm = async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id);

        if (!farm) {
            return res.status(404).json({ message: 'Farm not found' });
        }

        // Verify ownership
        if (farm.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        // Prevent device reassignment
        const {
            device,
            deviceId,
            user,
            season,
            ...safeUpdates
        } = req.body;

        // Auto-update season if sowing date changes
        if (safeUpdates.dateOfSowing) {
            safeUpdates.season = getSeason(
                safeUpdates.dateOfSowing
            );
        }

        if (safeUpdates.tankDetails) {
            safeUpdates.totalCapacityLiters = calculateTankCapacityLiters(
                safeUpdates.tankDetails
            );
        }

        const updatedFarm = await Farm.findByIdAndUpdate(
            req.params.id,
            safeUpdates,
            {
                new: true,
                runValidators: true
            }
        )
            .populate(
                'device',
                'deviceId name status lastSeen isActive hardwareType topics'
            )
            .populate('current_crop')
            .populate('soilType');

        res.status(200).json(updatedFarm);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Delete a farm
// @route   DELETE /api/farms/:id
// @access  Private
const deleteFarm = async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id);

        if (!farm) return res.status(404).json({ message: 'Farm not found' });

        // Check user ownership
        if (farm.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        // 1:1 relationship — deleting the farm frees up its deviceId too.
        if (farm.device) {
            await Device.findByIdAndDelete(farm.device);
        }

        await farm.deleteOne();

        res.status(200).json({ id: req.params.id, message: 'Farm and its device removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all crops for dropdown
// @route   GET /api/farms/crops
// @access  Private

const getAllCrops = async (req, res) => {
    try {

        const crops = await CropFinalDataset
            .find({})
            .select('Crop')
            .sort({ Crop: 1 });

        res.status(200).json(crops);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Get all soil types for dropdown
// @route   GET /api/farms/soils
// @access  Private

const getAllSoils = async (req, res) => {
    try {

        const soils = await SoilDataset
            .find({})
            .select({ "Soil type": 1 })
            .sort({ 'Soil type': 1 });

        res.status(200).json(soils);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
    }
};

module.exports = {
    createFarm,
    getMyFarms,
    getFarmById,
    updateFarm,
    deleteFarm,
    getAllCrops,
    getAllSoils
};
