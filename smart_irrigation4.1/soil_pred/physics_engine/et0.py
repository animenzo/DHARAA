import math


def saturation_vapor_pressure(T):
    """
    FAO-56 Eq.:
    e°(T) = 0.6108 * exp(17.27T / (T + 237.3))
    """
    return 0.6108 * math.exp((17.27 * T) / (T + 237.3))

def mean_saturatuion_vap_pressure(Tmin,Tmax):
    e0tmax = saturation_vapor_pressure(Tmax)
    e0tmin = saturation_vapor_pressure(Tmin)
    return (e0tmin+e0tmax)/2

# def actual_sat_pressure(Tmin,Tmax,RH):
#     e0tmax = saturation_vapor_pressure(Tmax)
#     e0tmin = saturation_vapor_pressure(Tmin)

#     return (((e0tmax*RHmin)/100)+((e0tmin*RHmax)/100))/2

def slope_vapor_pressure_curve(T):
    """
    Δ = 4098 * e°(T) / (T + 237.3)^2
    """
    e0t = saturation_vapor_pressure(T)
    return (4098 * e0t) / ((T + 237.3) ** 2)


def calculate_et0(T,Tmin,Tmax, RH, u2, Rn, G=0):
    """
    FAO-56 Penman–Monteith Equation:

    ET0 =
    [0.408Δ(Rn - G) + γ(900/(T+273))u2(es-ea)] /
    [Δ + γ(1 + 0.34u2)]
    """

    gamma = 0.066

    es = mean_saturatuion_vap_pressure(Tmin,Tmax)
    ea = es * (RH / 100)
    delta = slope_vapor_pressure_curve(T)

    numerator = (
        0.408 * delta * (Rn - G)
        + gamma * (900 / (T + 273)) * u2 * (es - ea)
    )

    denominator = delta + gamma * (1 + 0.34 * u2)

    return numerator / denominator