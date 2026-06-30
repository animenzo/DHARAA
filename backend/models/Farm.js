const mongoose = require('mongoose');
const getSeason = require('../utils/getSeason');
const { calculateTankCapacityLiters } = require('../utils/tankCalculations');

const farmSchema = new mongoose.Schema({
    // --- NEW FIELD: Link farm to a specific user ---
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User' // Assuming your User model is named 'User'
    },
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        default: null
    },
    // -----------------------------------------------
    name: {
        type: String,
        required: [true, 'Farm name is required'],
        trim: true
    },
    farmShape: {
        type: String,
        enum: ['circle', 'rectangle'],
        required: true
    },

    farmDimensions: {
        diameter: {
            type: Number,
            default: null
        },
        length: {
            type: Number,
            default: null
        },
        width: {
            type: Number,
            default: null
        }
    },
    location: {
        type: String,
        trim: true
    },
    current_crop: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CropFinalDataset',
        required: true
    },
    coordinates: {
        lat: Number,
        lng: Number
    },
    tankDetails: {
        type: {
            type: String,
            enum: ['circle', 'rectangle'],
            trim: true
        },
        dimensions: {
            diameter: { type: Number, min: 0 },
            length: { type: Number, min: 0 },
            width: { type: Number, min: 0 }, // Added width for rectangle
            height: { type: Number, min: 0 }
        }
    },
    totalCapacityLiters: {
        type: Number,
        min: 0,
        default: null
    },
    soilType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SoilDataset',
        required: true
    },
    irrigationMethod: {
        type: String,
        enum: ['drip', 'sprinkler', 'surface'],
        required: true
    },
    dateOfSowing: {
        type: Date,
        required: true
    },
    mobileNumber: {
        type: String,
        required: true,
        trim: true
    },
    season: {
        type: String,
        
    },
    pincode: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    lastIrrigation: {
        type: Date,
        default: null
    },
    soilMoisture: {
        type: Number,
        default: 0
    },
    aiAutoEnabled: {
  type:    Boolean,
  default: false,
},
    
}, {
    timestamps: true
});

farmSchema.pre("save", async function() {

    if (this.dateOfSowing) {
        this.season = getSeason(this.dateOfSowing);
    }

    this.totalCapacityLiters = calculateTankCapacityLiters(this.tankDetails);
  
});

module.exports = mongoose.model('Farm', farmSchema);
