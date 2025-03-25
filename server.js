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
import nodemailer from "nodemailer"
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
const transfer = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
})

app.get("/", (req, res) => {
    res.send("Hello World");
});
app.get("/Freelance-Career-Launch-Guide", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "Freelance-Career-Launch-Guide.html"));
});

// Create Razorpay Order
app.post("/create-order", async (req, res) => {
    try {
        const { amount, email } = req.body;
        
        const options = {
            amount: amount * 100, // Convert to paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                customer_email: email // Store email in order notes
            }
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
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            email,  // Added email field
            filename,
            downloadUrl
        } = req.body;

        // Signature verification
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Payment signature verification failed"
            });
        }
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        console.log(downloadUrl)
        if (payment.status === "captured") {
            const customerEmail = payment.email;
            const customerPhone = payment.contact;
            await transfer.sendMail({
                from: process.env.EMAIL,
                to: customerEmail,
                subject: "Your File is Ready to Download",
                html: `
                    <p>Dear Customer,</p>
                    <p>Your requested file is now ready for download.</p>
                    <p><strong>Download Link:</strong> <a href="${downloadUrl}" target="_blank">${downloadUrl}</a></p>
                    <p>If you have any questions, feel free to contact our support team.</p>
                    <p>Best Regards,<br>YashTech Mine</p>
                `
            });
            
            console.log(`Email sent to ${customerEmail}`);
            return res.json({
                success: true,
                message: "Payment Verified",
                email: customerEmail,
                phone: customerPhone
            });
        } else {
            return res.status(400).json({ success: false, message: "Payment not captured" });
        }

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({
            success: false,
            message: `Internal server error: ${error.message}`
        });
    }
});

// Email validation function
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}
const transporter = nodemailer.createTransport({
    service: 'gmail',  // Or your preferred email service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
// Send Download Email Function
async function sendDownloadEmail(to, downloadUrl, filename) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: to,
            subject: 'Your Purchased Download is Ready',
            html: `
                <h1>Download Your File</h1>
                <p>Thank you for your purchase!</p>
                <p>Click the link below to download your file:</p>
                <a href="${downloadUrl}">Download ${filename}</a>
                <p>If the link doesn't work, please copy and paste the following URL in your browser:</p>
                <p>${downloadUrl}</p>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('Download email sent successfully');
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new Error('Failed to send download email');
    }
}
// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
