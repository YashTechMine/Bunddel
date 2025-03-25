import express from "express";
import path from "path";
import mongoose from "mongoose";
import Razorpay from "razorpay";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import Payment from "./model/Payment.js"; // Import Payment model
import { fileURLToPath } from "url";
import fs from "fs"

// Define __dirname manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

// Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Serve Static Files (Frontend)


app.get("/", (req, res) => {
    res.send("Hello World");
});
app.get("/Freelance-Career-Launch-Guide", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "Freelance-Career-Launch-Guide.html"));
});

// Create Razorpay Order
app.post("/create-order", async (req, res) => {
    try {
        const options = {
            amount: req.body.amount * 100, // Convert to paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify Razorpay Payment and Store in MongoDB
app.post("/verify-payment", async (req, res) => {
    try {
        console.log("Received verify payment request:", req.body); // Logging for debugging

        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            filename 
        } = req.body;

        // Validate required parameters
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required payment details" 
            });
        }

        // Validate filename
        if (!filename) {
            return res.status(400).json({ 
                success: false, 
                message: "Filename is required" 
            });
        }

        // Verify payment signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest("hex");

        // Signature verification
        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid payment signature" 
            });
        }

        // Save payment details to MongoDB
        const newPayment = new Payment({
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id,
            signature: razorpay_signature,
            amount: 500,
            currency: "INR",
            filename: filename || "default.zip"
        });

        await newPayment.save();

        // Prepare file for download
        const filePath = path.join(__dirname, "zip", filename);

        // Log the file path for debugging
        console.log("Attempting to download file from:", filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return res.status(404).json({ 
                success: false, 
                message: `Download file not found: ${filename}` 
            });
        }

        // Send file as response
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error("Download error:", err);
                res.status(500).json({ 
                    success: false, 
                    message: `Error downloading file: ${err.message}` 
                });
            }
        });
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ 
            success: false, 
            message: `Internal server error: ${error.message}` 
        });
    }
});
// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
