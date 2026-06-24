const mongoose = require('mongoose');

const CancionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: String,
    uri: { type: String, required: true },
    artwork: String,
    duration: Number,
    sourceName: String,
}, { _id: false });

const PlaylistSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    nombre: { type: String, required: true, maxlength: 100 },
    canciones: { type: [CancionSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Playlist', PlaylistSchema);
