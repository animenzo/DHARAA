class Parameters:

    def __init__(self, crop_name, soil_texture, sowing_date, crop, soil):

        self.crop_name = crop_name
        self.soil_texture = soil_texture
        self.sowing_date = sowing_date

        # -----------------------------
        # Soil Parameters
        # -----------------------------
        if not crop or not soil:
            raise ValueError("Complete crop and soil master data must be supplied by the backend.")

        self.FC = soil["FC (v%)"] / 100
        self.PWP = soil["PWP (v%)"] / 100

        # -----------------------------
        # Crop Parameters
        # -----------------------------
        # MongoDB cannot preserve the original CSV headers containing dots;
        # imported records store them as nested objects (Init/Dev).
        self.Lini = crop.get("Init. (Lini)", crop.get("Init", {}).get(" (Lini)"))
        self.Ldev = crop.get("Dev. (Ldev)", crop.get("Dev", {}).get(" (Ldev)"))
        if self.Lini is None or self.Ldev is None:
            raise ValueError(f"Crop '{crop_name}' has incomplete growth-stage durations.")
        self.Lmid = crop["Mid (Lmid)"]
        self.Llate = crop["Late (Llate)"]
        self.Total_days = int(crop["Total_days"])
        
        self.Kc_ini = crop["Kc ini"]
        self.Kc_mid = crop["Kc mid"]
        self.Kc_end = crop["Kc end"]

        self.Zr_min = crop["Min_Root"]
        self.Zr_max = crop["Max_Root"]

        self.MAD = crop["p (MAD)"]

        # -----------------------------
        # Weather (hardcoded for now)
        # -----------------------------
        self.Tmax = 40             # max temperature
        self.Tmin= 20             # min temperaturte in (celsious)
        self.Tmean= 30             # min temperaturte in (celsious)
                   
        self.RH = 60               # Relative Humidity max 
       
        self.u2 = 2.0              # Wind Speed
        self.Rn = 14               # net reditation
        self.rainfall = 0
        self.soli_moisture_Sensor  = 26
