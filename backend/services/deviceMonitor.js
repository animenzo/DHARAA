const Device =
require("../models/Device");

const startMonitor =
()=>{

setInterval(
async()=>{

const timeout =
Date.now() -
(60 * 1000);

await Device.updateMany(
{
    lastSeen:{
        $lt:new Date(timeout)
    }
},
{
    status:"offline"
}
);

},
30000
);

};

module.exports =
startMonitor;