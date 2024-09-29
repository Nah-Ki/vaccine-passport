const CryptoJs = require('crypto-js');
const jwt = require('jsonwebtoken');
const { Admin, User, Place, Vaccine, VaccineLot, UserVaccine } = require('../models');

exports.login = async (req, res) => {
    try {
        const admin = await Admin.findOne({
            username: req.body.username
        });
        if (!admin) return res.status(401).json('Wrong username');
        const decryptedPass = CryptoJs.AES.decrypt(
            admin.password,
            process.env.PASSWORD_SECRET_KEY
        ).toString(CryptoJs.enc.Utf8);
        if (decryptedPass !== req.body.password) return res.status(401).json('Wrong password');

        const token = jwt.sign({
            id: admin._id
        }, process.env.TOKEN_SECRET_KEY);
        admin.password = undefined;

        res.status(200).json({
            token,
            admin
        });
    } catch(err) {
        console.log(err);
        res.status(500).json(err);
    }
}

// admin dashboard summary data
exports.summary = async (req, res) => {
    try {
        // Get total users and places
        const totalUser = await User.countDocuments({});
        const totalPlace = await Place.countDocuments({});

        // Count users who have been vaccinated
        const userVaccinated = await UserVaccine.aggregate([
            { $group: { _id: "$user" } }
        ]);

        // Count total vaccine doses available
        const totalVaccineDose = await VaccineLot.aggregate([
            {
                $group: {
                    _id: null,
                    totalQuantity: { $sum: "$quantity" }
                }
            }
        ]);

        // Count total vaccine doses used
        const totalVaccineDoseUsed = await VaccineLot.aggregate([
            {
                $group: {
                    _id: null,
                    totalVaccinated: { $sum: "$vaccinated" }
                }
            }
        ]);

        // Get latest vaccine lots
        const latestVaccineLot = await VaccineLot.find({})
            .sort('-createdAt')
            .limit(4)
            .populate('vaccine');

        // Count users with exactly one dose
        const userWithOneDose = await UserVaccine.aggregate([
            { $group: { _id: "$user", doseCount: { $sum: 1 } } },
            { $match: { doseCount: 1 } },
            { $count: "count" }
        ]);

        // Count users with two or more doses
        const userWithAboveTwoDose = await UserVaccine.aggregate([
            { $group: { _id: "$user", doseCount: { $sum: 1 } } },
            { $match: { doseCount: { $gte: 2 } } },
            { $count: "count" }
        ]);

        // Prepare response
        res.status(200).json({
            totalUser,
            totalPlace,
            userVaccinated: userVaccinated.length,
            availableVaccineDose: (totalVaccineDose[0]?.totalQuantity || 0) - (totalVaccineDoseUsed[0]?.totalVaccinated || 0),
            latestVaccineLot,
            userVaccinatedAnalyst: {
                totalUser,
                userWithAboveTwoDose: userWithAboveTwoDose[0]?.count || 0,
                userWithOneDose: userWithOneDose[0]?.count || 0,
                userWithZeroDose: totalUser - userVaccinated.length
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
}
