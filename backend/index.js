// backend/index.js
const express = require('express');
const cors = require("cors");
const jwt = require("jsonwebtoken");
const zod = require("zod");
require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Import db connection
require('./db');

const { User, PurchaseHistory } = require("./db");
const postRoutes = require('./routes/post');
const authMiddleware = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SIGNUP ROUTE //

const signupBody = zod.object({
    username: zod.string().email(),
	firstName: zod.string(),
	lastName: zod.string(),
	password: zod.string()
})
app.post("/signup", async (req, res) => {
    const { success } = signupBody.safeParse(req.body)
    if (!success) {
        return res.status(411).json({
            message: "Email already taken / Incorrect inputs"
        })
    }

    const existingUser = await User.findOne({
        username: req.body.username
    })

    if (existingUser) {
        return res.status(411).json({
            message: "Email already taken/Incorrect inputs"
        })
    }

    const user = await User.create({
        username: req.body.username,
        password: req.body.password,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
    })
    const userId = user._id;



    const token = jwt.sign({
        userId
    }, process.env.JWT_SECRET);

    res.json({
        message: "User created successfully",
        token: token
    })
})

// SIGNIN ROUTE //

const signinBody = zod.object({
    username: zod.string().email(),
	password: zod.string()
})
app.post("/signin", async (req, res) => {
    const { success } = signinBody.safeParse(req.body)
    if (!success) {
        return res.status(411).json({
            message: "Email already taken / Incorrect inputs"
        })
    }

    const user = await User.findOne({
        username: req.body.username,
        password: req.body.password
    });

    if (user) {
        const token = jwt.sign({
            userId: user._id,
            username: user.username,
            email: user.username
        }, process.env.JWT_SECRET);
  
        res.json({
            token: token,
            user: {
                username: user.username,
                email: user.username
            }
        })
        return;
    }

    res.status(411).json({
        message: "Error while logging in"
    })
})

// Routes
app.use('/api/posts', postRoutes);



const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB file size limit
  }
});

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Route to handle product image upload and get structured JSON response
app.post("/upload-product", upload.single("productImage"), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    // Read the uploaded file
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    // Initialize the model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          description: "Product comparison and sustainability metrics",
          type: "object",
          properties: {
            product_searched: {
              type: "object",
              properties: {
                product: { type: "string", description: "Name of the product" },
                eco_score: { type: "string", description: "Eco-score from 1 to 10" },
                carbon_footprint: { type: "string", description: "Carbon footprint in kg CO2, just the number" },
                water_usage: { type: "string", description: "Water usage in liters, just the number" },
                waste_generated: { type: "string", description: "Waste generated in kg, just the number" },
              },
              required: ["product", "eco_score"],
            },
            better_alternative_product: {
              type: "object",
              properties: {
                product: { type: "string", description: "Name of the alternative product" },
                eco_score: { type: "string", description: "Eco-score from 1 to 10" },
                carbon_footprint: { type: "string", description: "Carbon footprint in kg CO2, just the number" },
                water_usage: { type: "string", description: "Water usage in liters, just the number" },
                waste_generated: { type: "string", description: "Waste generated in kg, just the number" },
              },
              required: ["product", "eco_score"],
            },
          },
          required: ["product_searched", "better_alternative_product"],
        },
      },
    });

    // Detailed prompt with image analysis
    const prompt = `
    Perform a comprehensive sustainability analysis of the uploaded product image.

    Detailed Analysis Requirements:
    1. Precisely identify the exact product type and brand from the image
    2. Conduct an in-depth assessment of its current environmental impact
    3. Research and propose a genuine, more sustainable alternative specific to this product

    Sustainability Metrics Guidelines:
    - Provide accurate, data-driven eco-scores from 1-10
    - Include precise carbon footprint calculations
    - Estimate water usage and waste generation
    - Base calculations on verifiable industry and manufacturer data
    - Compare the original product with a superior eco-friendly alternative

    Response Format:
    - Use scientifically grounded, specific metrics
    - Avoid generic or placeholder data
    - Ensure each metric is backed by research
    `;

    // Prepare the request with the image
    const result = await model.generateContent([
      { text: prompt },
      { 
        inlineData: { 
          mimeType: "image/jpeg", 
          data: base64Image 
        } 
      }
    ]);

    // Log raw result for debugging
    console.log("Raw AI Response:", result.response.text());

    // Parse the JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(result.response.text());
    } catch (parseError) {
      console.error("JSON Parsing Error:", parseError);
      return res.status(500).json({ 
        error: "Failed to parse AI response", 
        rawResponse: result.response.text() 
      });
    }

    // Delete the temporary uploaded file
    fs.unlinkSync(req.file.path);

    // Send the parsed response
    res.json(parsedResponse);

  } catch (error) {
    console.error("Detailed Error:", error);
    res.status(500).json({ 
      error: "Something went wrong during product analysis", 
      details: error.message 
    });
  }
});







// Route to save purchase history
app.post('/save-purchase', async (req, res) => {
  try {
    const { 
      userId, 
      purchased, 
      alternative 
    } = req.body;

    // Validate input
    if (!userId || !purchased || !alternative) {
      return res.status(400).json({ 
        message: 'Missing required fields' 
      });
    }

    // Convert string values to numbers
    const purchaseEntry = new PurchaseHistory({
      userId,
      purchased: {
        product: purchased.product,
        eco_score: parseFloat(purchased.eco_score),
        water_usage: parseFloat(purchased.water_usage),
        carbon_footprint: parseFloat(purchased.carbon_footprint),
        waste_generated: purchased.waste_generated 
          ? parseFloat(purchased.waste_generated) 
          : undefined
      },
      alternative: {
        product: alternative.product,
        eco_score: parseFloat(alternative.eco_score),
        water_usage: parseFloat(alternative.water_usage),
        carbon_footprint: parseFloat(alternative.carbon_footprint),
        waste_generated: alternative.waste_generated 
          ? parseFloat(alternative.waste_generated) 
          : undefined
      }
    });

    // Save the purchase history
    const savedPurchase = await purchaseEntry.save();

    res.status(201).json({
      message: 'Purchase history saved successfully',
      purchase: savedPurchase
    });
  } catch (error) {
    console.error('Error saving purchase history:', error);
    res.status(500).json({ 
      message: 'Failed to save purchase history', 
      error: error.message 
    });
  }
});

// Route to get purchase history for a user
app.get('/purchase-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const purchaseHistory = await PurchaseHistory.find({ userId })
      .sort({ purchaseDate: -1 }); // Sort by most recent first

    res.status(200).json({
      message: 'Purchase history retrieved successfully',
      purchases: purchaseHistory
    });
  } catch (error) {
    console.error('Error retrieving purchase history:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve purchase history', 
      error: error.message 
    });
  }
});


// Add this to your backend/index.js file

app.get("/leaderboard", async (req, res) => {
  try {
    // Aggregate eco scores for all users
    const leaderboardResults = await User.aggregate([
      // Join with PurchaseHistory to include all purchases for each user
      {
        $lookup: {
          from: "purchasehistories", // Ensure collection name matches in MongoDB
          localField: "_id",
          foreignField: "userId",
          as: "purchases"
        }
      },
      // Unwind the purchases array (creates a document for each purchase)
      {
        $unwind: {
          path: "$purchases",
          preserveNullAndEmptyArrays: true // Keep users with no purchases
        }
      },
      // Group by user and calculate average eco score
      {
        $group: {
          _id: "$_id",
          username: { $first: "$username" },
          firstName: { $first: "$firstName" },
          lastName: { $first: "$lastName" },
          eco_scores: {
            $push: {
              $ifNull: ["$purchases.purchased.eco_score", null] // Collect eco scores, handle nulls
            }
          }
        }
      },
      // Calculate the average eco score, handling users with no purchases
      {
        $project: {
          username: 1,
          firstName: 1,
          lastName: 1,
          eco_score: {
            $cond: {
              if: { $gt: [{ $size: "$eco_scores" }, 0] }, // Check if there are any scores
              then: {
                $avg: {
                  $filter: {
                    input: "$eco_scores", // Filter out null values
                    cond: { $ne: ["$$this", null] }
                  }
                }
              },
              else: 0 // Default score for users with no purchases
            }
          }
        }
      },
      // Sort by eco score in descending order
      {
        $sort: { eco_score: -1 }
      },
      // Limit to top 10 users
      {
        $limit: 10
      }
    ]);

    // Map the results to match the desired response format
    const formattedResults = leaderboardResults.map((user) => ({
      _id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      eco_score: Math.round(user.eco_score) // Round eco_score to nearest integer
    }));

    // Send the formatted results as a JSON response
    res.json({ users: formattedResults });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({
      message: "Failed to retrieve leaderboard",
      error: error.message
    });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});