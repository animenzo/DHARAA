

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>


#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <HardwareSerial.h>

BlynkTimer timer;

unsigned long __delay_start;
inline void delay_ms_replacement(unsigned long ms){
  __delay_start = millis();
  while(millis() - __delay_start < ms) {}
}


//WIFI SETUP
char auth[] = BLYNK_AUTH_TOKEN;
char ssid[] = "Galaxy A16 5G 7044";
char pass[] = "asundaymonday";


// ------------------- Pin Definitions -------------------
// Sensors
#define TRIG_PIN 32
#define ECHO_PIN 33
#define soil_1 34   
#define soil_2 35   
#define RAIN_PIN 25  
#define DHTPIN 4
#define DHTTYPE DHT11
// #define server_pin 2
#define push_button 13 
// Relays (Active LOW)
#define valve_1 18  // Solenoid valve 1
#define valve_2 19   // Solenoid valve 2
#define pump 23   // Pump relay

// SIM800 UART pins
#define SIM800_TX 17  // ESP32 TX -> SIM800 RX  
#define SIM800_RX 16  // ESP32 RX <- SIM800 TX
#define sim800 Serial2
// variables 
int m1,m2=0;
int Tmoisture=0;
bool rain=0;
float h,t=0;
int setmoisture=0;
bool physical_btn=0;
bool pump_status=0;
int webpump=0;
long duration;
int tank_height;
bool lastButtonState = LOW;  // store previous state
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50; // ms
int lcdPage = 0;


// ------------------- Objects -------------------
LiquidCrystal_I2C lcd(0x27, 16, 2); 
DHT dht(DHTPIN, DHTTYPE);


// ============================ HiveMQ Cloud========================================================
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

const char* mqtt_server = "0f87368f64434d248d788f3d8f6b9700.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "ESP32";
const char* mqtt_password = "Dharaa2026";

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg="";
  for(unsigned int i=0;i<length;i++) msg+=(char)payload[i];

  if(String(topic)=="irrigation/pump") webpump = msg.toInt();
  if(String(topic)=="irrigation/setmoisture") setmoisture = msg.toInt();
}

void reconnectMQTT(){
  while(!mqttClient.connected()){
    if(mqttClient.connect("ESP32_Irrigation", mqtt_user, mqtt_password)){
      mqttClient.subscribe("irrigation/pump");
      mqttClient.subscribe("irrigation/setmoisture");
    } else {
      delay_ms_replacement(5000);
    }
  }
}



// ================= GSM SMS Integration ==================


String phone_number = "+918000923209"; 

// Function to send SMS using SIM800
void sendSMS(String message) {
  sim800.println("AT+CMGF=1");  // Set SMS to text mode
  delay_ms_replacement(500);
  sim800.print("AT+CMGS=\"");
  sim800.print(phone_number);
  sim800.println("\"");
  delay_ms_replacement(500);
  sim800.print(message);
  delay_ms_replacement(200);
  sim800.write(26); 
  delay_ms_replacement(3000);
}

// Flags to avoid repeated SMS
bool systemOnSMSsent = false;
bool pumpLastState = false;
bool rainLastState = false;
unsigned long lastTempCheck = 0;

void checkEventsAndSendSMS() {
  // 1. System ON (only once after boot)
  if (!systemOnSMSsent) {
    sendSMS(" Farm server is now online .");
    systemOnSMSsent = true;
  }

  // 2. Pump ON (send only when state changes OFF -> ON)
  if (pump_status && !pumpLastState) {
    sendSMS(" Pump turned ON.");
  }
  pumpLastState = pump_status;

  // 3. Rain detected (send only when state changes)
  if (rain && !rainLastState) {
    sendSMS("Rain detected! Irrigation paused.");
  }
  rainLastState = rain;

  // 4. Low water temperature (<15°C), check every 60s
  if (millis() - lastTempCheck > 60000) {
    if (t < 15 && t > 0) { // filter invalid readings
      sendSMS("Warning: Low water temperature = " + String(t) + " C");
    }
    lastTempCheck = millis();
  }
}



// Led graphic Funtion

byte waterDrop[8] = { // Moisture
  B00100,
  B00100,
  B01110,
  B11111,
  B11111,
  B01110,
  B00100,
  B00000
};

byte tempIcon[8] = {  // Temp
  B00100,
  B01010,
  B01010,
  B01010,
  B01110,
  B11111,
  B11111,
  B01110
};

byte humIcon[8] = {   // Humidity
  B00100,
  B00100,
  B01110,
  B11111,
  B11111,
  B11111,
  B01110,
  B00000
};

byte pumpIcon[8] = {  // Pump
  B11111,
  B10001,
  B11111,
  B00100,
  B00100,
  B00100,
  B11111,
  B00000
};

byte btnIcon[8] = {   // Button
  B00000,
  B00100,
  B00100,
  B11111,
  B11111,
  B00100,
  B00100,
  B00000
};

byte rainIcon[8] = {  // Rain
  B10101,
  B01010,
  B10101,
  B01010,
  B10101,
  B01010,
  B00000,
  B00000
};

byte tankIcon[8] = {  // Tank
  B11111,
  B10001,
  B10101,
  B10101,
  B10101,
  B10001,
  B11111,
  B00000
};



//pump ctrl 
int s_delay=100;
void pump_control(){
  if(webpump && !physical_btn)
    { 
      if(m1<setmoisture||m2<setmoisture)
      {
      // Serial.println("active");
      digitalWrite(pump,LOW);
      delay_ms_replacement(s_delay);
      pump_status=1;
        if(m1<setmoisture){
            digitalWrite(valve_1,LOW) ;
            delay_ms_replacement(s_delay);
            
          }
          else{
            digitalWrite(valve_1,HIGH) ;
            delay_ms_replacement(s_delay);

          }
        if(m2<setmoisture){
          digitalWrite(valve_2,LOW) ;
          delay_ms_replacement(s_delay);
          
        }
        else{
          digitalWrite(valve_2,HIGH) ;
          delay_ms_replacement(s_delay);

        }
      }
      else{
        digitalWrite(pump,HIGH);
        delay_ms_replacement(s_delay);
        digitalWrite(valve_1,HIGH) ;
        delay_ms_replacement(s_delay);
        digitalWrite(valve_2,HIGH) ;
        pump_status=0;
      }
  }
  else if(physical_btn){
  
    digitalWrite(pump,LOW);
    delay_ms_replacement(s_delay);
    digitalWrite(valve_1,LOW);
    delay_ms_replacement(s_delay);
    digitalWrite(valve_2,LOW);
    pump_status=1;
  
  }
  else{
    digitalWrite(pump,HIGH);
    delay_ms_replacement(s_delay);
    digitalWrite(valve_1,HIGH);
    delay_ms_replacement(s_delay);
    digitalWrite(valve_2,HIGH);
    pump_status=0;
              
  }
  
}


// get moisture func
int read1 =0;
int read2 =0;

void get_moisture() {
read1=analogRead(soil_1);
read2=analogRead(soil_2);
//  Serial.print("Raw Sensor Value: ");
//   Serial.println(read1);
//   Serial.println(read2);
m1=map(read1,2500,1200,0,100);
m2=map(read2,2550,1250,0,100);
//  Serial.print("Raw Sensor percantage: ");
//   Serial.println(m1);
//   Serial.println(m2);
Tmoisture=(m1+m2)/2;
}

//physical btn on off
void physical_check(){

 physical_btn = digitalRead(push_button);
//  physical_ctrl();
 Serial.println(physical_btn);

 

}


// Rain level (0–1)
void readRain() {
 rain = !(digitalRead(RAIN_PIN));
 Serial.println(rain);
}

void DHT11sensor() {
   h = dht.readHumidity();
   t = dht.readTemperature();
}

int distance=0;
int water=0;


void tankheight(){
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Read the echo pulse width
  duration = pulseIn(ECHO_PIN, HIGH);

  // Convert time to distance
  distance = duration * 0.034 / 2;  // speed of sound ~0.034 cm/µs
if(distance>1 && distance<1000){
  tank_height=distance;
}

water= 10-((3.14*100*tank_height)/1000);

  // Print result
  // Serial.print("water: ");
  // Serial.print(water);
  Serial.print(distance);
  Serial.println(" cm");


}

// LED Function 
void updateLCD() {
 lcd.clear();

  if (lcdPage == 0) {
    // Page 1 → Moisture + Set Moisture + Temp + Humidity
    lcd.setCursor(0, 0);
    lcd.write(0); // Water drop
    lcd.print("CMOS:");
    lcd.print(Tmoisture);
    lcd.setCursor(8, 0);
     lcd.print(" SMOS:");
    lcd.print(setmoisture);
    

    lcd.setCursor(0, 1);
    lcd.write(1); // Temp
    lcd.print("TMP:");
    lcd.print((int)t);
    lcd.print("C ");

    lcd.write(2); // Humidity
    lcd.print("HUM:");
    lcd.print((int)h);
    lcd.print("%");
  }
  else if (lcdPage == 1) {
    // Page 2 → Pump + Button + Rain + Tank
    lcd.setCursor(0, 0);
    lcd.write(3); // Pump
    lcd.print("PMP:");
    lcd.print(pump_status ? "ON " : "OFF");

    lcd.setCursor(9, 0);
    lcd.write(4); // Button
    lcd.print("BTN:");
    lcd.print(physical_btn ? "ON" : "OFF");

    lcd.setCursor(0, 1);
    lcd.write(5); // Rain
    lcd.print("RAN:");
    lcd.print(rain ? "YES " : "NO ");

    lcd.setCursor(9, 1);
    lcd.write(6); // Tank
    lcd.print("TNK:");
    lcd.print(water);
  }

  lcdPage = (lcdPage + 1) % 2; // Toggle pages
}



TaskHandle_t SensorTaskHandle = NULL;
TaskHandle_t ControlTaskHandle = NULL;

void SensorTask(void *pvParameters){
  while(true){
    get_moisture();
    tankheight();
    DHT11sensor();
    readRain();
    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
}

void ControlTask(void *pvParameters){
  while(true){
    physical_check();
    pump_control();
    checkEventsAndSendSMS();
    vTaskDelay(200 / portTICK_PERIOD_MS);
  }
}

void setup() 
{
  Serial.begin(115200);
  WiFi.begin(ssid, pass);
 espClient.setInsecure();
 mqttClient.setServer(mqtt_server,mqtt_port);
 mqttClient.setCallback(mqttCallback);

//sonar setup
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  // Relays
  pinMode(valve_1, OUTPUT);
  pinMode(valve_2, OUTPUT);
  pinMode(pump, OUTPUT);
  digitalWrite(valve_1, HIGH);
  digitalWrite(valve_2, HIGH);
  digitalWrite(pump, HIGH);

  // Ultrasonic
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT); 

  pinMode(soil_1, INPUT_PULLUP); 
  pinMode(soil_2, INPUT_PULLUP); 
  //push btn 
  pinMode(push_button, INPUT_PULLDOWN); 
  pinMode(RAIN_PIN, INPUT_PULLDOWN); 

 

//LED Initialization
lcd.begin();
  lcd.backlight();

  // Create custom characters
lcd.createChar(0, waterDrop);
lcd.createChar(1, tempIcon);
lcd.createChar(2, humIcon);
lcd.createChar(3, pumpIcon);
lcd.createChar(4, btnIcon);
lcd.createChar(5, rainIcon);
lcd.createChar(6, tankIcon);


  // Page 1: Show system name with icons
   lcd.clear();
  lcd.setCursor(1, 0);
  lcd.print("  ");               // Pump icon
  lcd.write(0);               // Pump icon
  lcd.print(" SMART ");
  lcd.write(0);               // Water drop

  lcd.setCursor(2, 1);
  lcd.print("IRRIGATION");

  delay_ms_replacement(2500);
  lcd.clear();

  // ---- Loading Screen ----
  lcd.setCursor(3, 0);
  lcd.print("Starting");
  lcd.setCursor(0, 1);
  for (int i = 0; i < 16; i++) {
    lcd.setCursor(i,1);
    lcd.print("-"); // Full block character
    lcd.print(">"); // Full block character
    delay_ms_replacement(120);
  }
  delay_ms_replacement(1000);
  lcd.clear();
  
  
  // DHT
  dht.begin();
sim800.begin(9600, SERIAL_8N1, SIM800_RX, SIM800_TX);
delay_ms_replacement(1000);


  // timer.setInterval(100L, DHT11sensor);
  timer.setInterval(2000L, updateLCD);
  timer.setInterval(2000L, sendToMQTT);

xTaskCreatePinnedToCore(SensorTask,"SensorTask",4096,NULL,1,&SensorTaskHandle,1);
xTaskCreatePinnedToCore(ControlTask,"ControlTask",4096,NULL,1,&ControlTaskHandle,1);
}


void sendToMQTT()
  {
    mqttClient.publish("irrigation/moisture1", String(m1).c_str());  // Soil moisture
    mqttClient.publish("irrigation/moisture2", String(m2).c_str());  // Soil moisture
    mqttClient.publish("irrigation/temp", String(t).c_str());          // Temperature 
    mqttClient.publish("irrigation/humidity", String(h).c_str());          // Humidity
    mqttClient.publish("irrigation/rain", String(rain).c_str());          // Rain
    mqttClient.publish("", String(physical_btn).c_str());          // physical btn
    mqttClient.publish("irrigation/pumpstatus", String(pump_status).c_str());          // pump status
    mqttClient.publish("irrigation/water", String(water).c_str());          // pump status
    mqttClient.publish("irrigation/online", "1");                    // server online indicate
  }





void loop(){
if(!mqttClient.connected()) reconnectMQTT(); mqttClient.loop();
timer.run();
irrigation/button} 