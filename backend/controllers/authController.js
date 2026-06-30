const User = require("../models/User");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const crypto = require("crypto");

// const Device =
// require("../models/Device");
// const { provisionDevice }    = require("../services/provisioningService");

const DeviceTemplate =
require("../models/Template");
exports.signup = async (req,res)=>{
  try {
    const {name,email,password} = req.body;
    if(!email || !password ){
      return res.status(400).json({
        message:"Please provide all required fields"
      });
    }

    const exists = await User.findOne({email})

    if(exists){
      return res.status(400).json({
        message:"User already exists. Please login."
      })
    }
    const hashedPassword = await bcrypt.hash(password,10);
    const user = await User.create({
      name,
      email,
      password:hashedPassword
    })

//     const template =
// await DeviceTemplate.create({

//     userId:user._id,

//     sensors:[
//         "moisture",
//         "temperature",
//         "humidity",
//         "rain",
//         "waterLevel"
//     ],

//     actuators:[
//         "pump"
//     ]
// });

// const device =
// await Device.create({

//     userId:user._id,

//     templateId:template._id,

//     deviceId:
//         crypto.randomUUID(),

//     authToken:
//         crypto.randomBytes(32)
//         .toString("hex")
// });

// user.iot = {
//     device:device._id,
//     template:template._id
// };
  // let iotProvisioning = null;
  //   try {
  //     const result = await provisionDevice(user);
  //     iotProvisioning = {
  //       deviceId:   result.device.deviceId,
  //       authToken:  result.plainToken,
  //       topics:     result.device.topics,
  //       templateId: result.template._id,
  //     };
  //   } catch (provErr) {
  //     // Non-fatal: provisioning failure must not block signup
  //     console.error("⚠️  Device provisioning failed for user", user._id, ":", provErr.message);
  //   }
// await user.save();

    const token = generateToken(user._id);
    res.cookie("token",token,{
      httpOnly:true,
      secure:process.env.NODE_ENV === "production",
      sameSite:"strict",
      maxAge:7*24*60*60*1000
    })
    // res.status(201).json({
    //  token,user
    // })

    res.status(201).json({
      token,
      user,
      // ...(iotProvisioning ? { iot: iotProvisioning } : {}),
    });
  } catch (error) {
    res.status(500).json({
      message:"Signup failed. Please try again later."
    })
  }
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
};


exports.forgotPassword = async (req, res) => {
  try {
    // console.log("Forgot password hit");

    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { resetToken, hashedToken } = generateResetToken();

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset/${resetToken}`;

    // console.log("Sending email...");

    await sendEmail(email, "Password Reset", resetUrl);

    console.log("Email sent");

    res.json({ message: "Reset link sent to email" });

  } catch (err) {
    console.error("❌ FORGOT ERROR:", err); // 🔥 IMPORTANT
    res.status(500).json({ message: err.message });
  }
};



exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user)
    return res.status(400).json({ message: "Token expired or invalid" });

  user.password = await bcrypt.hash(password, 10); // will be hashed by pre-save hook
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  res.json({ message: "Password reset successful" });
};


// exports.getMe = async (req, res) => {
//   try {
//     // req.user is set by your 'protect' middleware
//     const user = await User.findById(req.user.id).select("-password"); 

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.status(200).json(user);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server Error" });
//   }
// };


exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};