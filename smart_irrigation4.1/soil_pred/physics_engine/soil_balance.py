def update_soil_moisture(theta, ETc, Zr, FC, PWP):
    """
    Δθ = ETc / (1000 Zr)

    θ(t+1) = θ(t) - Δθ + (P + I)/(1000 Zr)
    """

    delta_theta = ETc / (1000 * Zr)
    total_evaporation = delta_theta

    # theta_new = theta - delta_theta + (P + I) / (1000 * Zr)
    theta_new = theta - delta_theta 
    # Safety limits
    # theta_new = min(theta_new, FC)
    # theta_new = max(theta_new, PWP)

    return theta_new , total_evaporation