// backend/db.js
const mongoose = require('mongoose');
require('dotenv').config();

// Database connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("Successfully connected to DB"))
.catch((error) => console.error("Error connecting to DB:", error));

// User Schema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minLength: 6,
    },
    firstName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50,
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50,
    },
}, { timestamps: true });











const PurchaseHistorySchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  purchaseDate: { 
    type: Date, 
    default: Date.now 
  },
  purchased: {
    product: { 
      type: String, 
      required: true 
    },
    eco_score: { 
      type: Number, 
      required: true 
    },
    water_usage: { 
      type: Number, 
      required: true 
    },
    carbon_footprint: { 
      type: Number, 
      required: true 
    },
    waste_generated: { 
      type: Number 
    }
  },
  alternative: {
    product: { 
      type: String, 
      required: true 
    },
    eco_score: { 
      type: Number, 
      required: true 
    },
    water_usage: { 
      type: Number, 
      required: true 
    },
    carbon_footprint: { 
      type: Number, 
      required: true 
    },
    waste_generated: { 
      type: Number 
    }
  }
});


// PurchaseHistory Model
const PurchaseHistory = mongoose.model('PurchaseHistory', PurchaseHistorySchema);

// User Model
const User = mongoose.model('User', userSchema);

module.exports = {
    User, PurchaseHistory
};