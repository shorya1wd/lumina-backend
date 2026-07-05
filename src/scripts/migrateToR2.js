import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import https from "https";
import { User } from "../models/user.models.js";
import { Video } from "../models/video.models.js";
import { uploadOnR2 } from "../utils/r2.js";
import connectDB from "../db/connect.js";

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(dest));
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
};

const processUrl = async (url, folderName) => {
    if (!url || !url.includes('cloudinary.com')) return url; // Skip if already migrated or empty
    
    // Force HTTPS because Node's https module will crash on http:// URLs
    const secureUrl = url.replace('http://', 'https://');
    
    console.log(`\nMigrating: ${secureUrl}`);
    
    // Create a temporary file name based on the last part of the URL
    const fileName = secureUrl.split('/').pop();
    const tempPath = path.join(process.cwd(), `temp_${fileName}`);
    
    try {
        await downloadFile(secureUrl, tempPath);
        const r2Data = await uploadOnR2(tempPath, folderName);
        if (r2Data && r2Data.url) {
            console.log(`✅ Successfully migrated to: ${r2Data.url}`);
            return r2Data.url;
        }
        return url; // fallback to original if it failed
    } catch (error) {
        console.error(`❌ Error migrating ${url}:`, error);
        return url;
    }
};

const migrate = async () => {
    try {
        console.log("Connecting to database...");
        await connectDB();

        // 1. Migrate Users
        console.log("\n--- MIGRATING USERS ---");
        const users = await User.find({});
        for (const user of users) {
            let updated = false;
            
            if (user.avatar && user.avatar.includes('cloudinary.com')) {
                user.avatar = await processUrl(user.avatar, "avatars");
                updated = true;
            }
            
            if (user.coverImage && user.coverImage.includes('cloudinary.com')) {
                user.coverImage = await processUrl(user.coverImage, "covers");
                updated = true;
            }
            
            if (updated) {
                await user.save({ validateBeforeSave: false });
                console.log(`💾 Saved updated user: ${user.username}`);
            }
        }

        // 2. Migrate Videos
        console.log("\n--- MIGRATING VIDEOS ---");
        const videos = await Video.find({});
        for (const video of videos) {
            let updated = false;
            
            if (video.videoFile && video.videoFile.includes('cloudinary.com')) {
                video.videoFile = await processUrl(video.videoFile, "videos");
                updated = true;
            }
            
            if (video.thumbnail && video.thumbnail.includes('cloudinary.com')) {
                video.thumbnail = await processUrl(video.thumbnail, "thumbnails");
                updated = true;
            }
            
            if (updated) {
                await video.save({ validateBeforeSave: false });
                console.log(`💾 Saved updated video: ${video.title}`);
            }
        }

        console.log("\n🎉 --- MIGRATION COMPLETE --- 🎉");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
};

migrate();
