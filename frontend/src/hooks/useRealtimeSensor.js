// import {
//  useEffect,
//  useState
// }
// from "react";

// import socket
// from "../services/socket";

// export default function(){

// const [data,setData]
// =
// useState(null);

// useEffect(()=>{

// socket.on(
// "sensor-update",
// (sensor)=>{
// setData(sensor);
// }
// );

// return ()=>{

// socket.off(
// "sensor-update"
// );

// };

// },[]);

// return data;

// }

export { useSensorData as default } from "./useSensorData";