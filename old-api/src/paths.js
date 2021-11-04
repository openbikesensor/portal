const path = require('path');

const API_ROOT_DIR = path.resolve(__dirname, '../');

const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../../data/');

// Contains the subtree for processing files
const PROCESSING_DIR = path.join(DATA_DIR, 'processing');
const PROCESSING_OUTPUT_DIR = path.join(DATA_DIR, 'processing-output');

// Contains the subtree for processing files, without privatization techniques,
// used only for display of tracks to authors
const PROCESSING_DIR_PRIVATE = path.join(DATA_DIR, 'private');

// Contains original track files
const TRACKS_DIR = path.join(DATA_DIR, 'tracks');

// Cache directory for all obs-face calls
const OBS_FACE_CACHE_DIR = path.join(DATA_DIR, 'obs-face-cache');

module.exports = {
  API_ROOT_DIR,
  DATA_DIR,
  PROCESSING_DIR,
  PROCESSING_OUTPUT_DIR,
  PROCESSING_DIR_PRIVATE,
  TRACKS_DIR,
  OBS_FACE_CACHE_DIR,
};
