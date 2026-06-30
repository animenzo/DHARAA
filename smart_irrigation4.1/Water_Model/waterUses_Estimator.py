import pandas as pd
import math

def calculate_remaining_water_requirement(csv_file_path, crop_name, average_et0, area, days_since_sowing=0):
    """
    Calculates the total remaining water requirement for a crop.
    
    Parameters:
    - csv_file_path (str): Path to the daily schedule CSV (e.g., 'crop_schedule.csv').
    - crop_name (str): Name of the crop to filter by (e.g., 'Maize').
    - average_et0 (float): Average reference evapotranspiration (mm/day) for the season.
        - days_since_sowing (int): How many days late the user registered. Default is 0.
        
        Returns:
        - dict: Contains remaining days, total water needed (mm), and average daily need.
    """
    # 1. Load the schedule
    df = pd.read_csv(csv_file_path)
    
    # 2. Filter for the specific crop
    crop_df = df[df['CropName'] == crop_name]
    
    if crop_df.empty:
        return {"error": f"Crop '{crop_name}' not found in the schedule."}
    
    # 3. Filter out the days that have already passed before the user registered
    # If days_since_sowing is 30, we only care about DayAfterSowing > 30
    remaining_schedule = crop_df[crop_df['DayAfterSowing'] > days_since_sowing]
    
    if remaining_schedule.empty:
         return {"error": "The crop has already reached the end of its growing cycle."}
        
    # 4. Calculate daily ETc (Water Requirement) for the remaining days
    # ETc = Kc * ET0
    remaining_schedule['Daily_Water_mm'] = remaining_schedule['Kc'] * average_et0
    
    # 5. Sum the total remaining water requirement
    total_water_mm = remaining_schedule['Daily_Water_mm'].sum()
    remaining_days = len(remaining_schedule)
    total_water_liter= total_water_mm*area
    
    return {
        "crop": crop_name,
        "days_since_sowing_at_registration": days_since_sowing,
        "remaining_days_in_season": remaining_days,
        "total_water_required_mm": round(total_water_mm, 2),
        "total_water_liter":math.ceil(total_water_liter),
        "average_daily_water_mm": round(total_water_mm / remaining_days, 2)
    }



def calculate_irrigation_requirment(theta_target, theta_current, soil_volume):
    """
    Calculates the exact irrigation depth required to refill the soil to a target moisture level.
    
    Equation: I_depth = (theta_target - theta_current) * Zr * 1000
    
    Parameters:
    - theta_target (float): Target volumetric water content as a decimal (e.g., Field Capacity = 0.30).
    - theta_current (float): Current soil moisture from the IoT sensor as a decimal (e.g., 0.22).
    - root_depth_m (float): Current effective rooting depth of the crop in meters (Zr).
    
    Returns:
    - float: The required irrigation depth (I_depth) in millimeters.
    """
    # Safety check: If the soil is already at or above the target moisture, no water is needed.
    if theta_current >= theta_target:
        return 0.0
        
    # Apply the mathematical equation
    water_required = (theta_target - theta_current) * soil_volume * 1000
    
    # Return the result rounded to 2 decimal places for clean dashboard display
    return round(water_required, 2)


def calculate_irrigation_requirement(theta_target, theta_current, soil_volume):
    return calculate_irrigation_requirment(theta_target, theta_current, soil_volume)




# --- EXAMPLE USAGE (Based on the Tomato scenario) ---
if __name__ == "__main__":
   # --- EXAMPLE USAGE ---
# Scenario 1: Farmer registers on the exact day of sowing (0 days late)
    on_time_req = calculate_remaining_water_requirement(
        csv_file_path='soil_pred\crop_schedule.csv', 
        crop_name='Maize', 
        average_et0=5.0,     # Assuming average 5mm/day ET0
        area=1,               # area in meter squre
        days_since_sowing=0  # Registered on Day 0
    )
    print("Registered On Time:", on_time_req)

    # Scenario 2: Farmer registers 45 days late
    late_req = calculate_remaining_water_requirement(
        csv_file_path='soil_pred\crop_schedule.csv', 
        crop_name='Maize', 
        average_et0=5.0, 
        area=1,               # area in meter squre
        days_since_sowing=45 # Registered 45 days after sowing
    )
    print("Registered 45 Days Late:", late_req)
   
   
    target_moisture = 0.30   # Field Capacity (30%)
    sensor_moisture = 0.22   # Current IoT Sensor reading (22%)
    current_root_depth = 0.47 # Calculated Zr in meters

    water_required_mm = calculate_irrigation_requirment(
        theta_target=target_moisture, 
        theta_current=sensor_moisture, 
        soil_volume=current_root_depth
    )

    print(f"Irrigation Required: {water_required_mm} mm")
    # Output: Irrigation Required: 37.6 mm
