const mongoose = require('mongoose');

const SpotifyTokenSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    spotifyUserId: String,
    spotifyUsername: String,
    spotifyAvatar: String,
}, { timestamps: true });

module.exports = mongoose.model('SpotifyToken', SpotifyTokenSchema);
