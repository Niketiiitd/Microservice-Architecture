import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";

@Injectable()
export class ContactService {
    private transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    constructor() {
        // Initialize any necessary services or configurations
    }

    async sendEmail(email: string, subject: string, message: string): Promise<void> {
        try {
            const mailOptions = {
                from: process.env.SMTP_EMAIL,
                to: process.env.SMTP_EMAIL, // Your support email
                subject: `Contact Us: ${subject}`,
                text: `From: ${email}\n\nMessage:\n${message}`,
            };
            
            
            const result = await this.transporter.sendMail(mailOptions);
            console.log("Email send result:", result);
        } catch (error) {
            console.error("Error sending email:", error);
            throw error;
        }
    }

    getStatus(): { message: string } {
        return { message: "Contact API is running." };
    }
}