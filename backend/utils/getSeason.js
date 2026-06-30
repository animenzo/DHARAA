const getSeason = (date) => {
    const month = new Date(date).getMonth() + 1;

    if (month >= 5 && month <= 8) {
        return "Kharif";
    }

    if (month >= 9 && month <= 12) {
        return "Rabi";
    }

    return "Zaid";
};

module.exports = getSeason;