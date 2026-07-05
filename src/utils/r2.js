import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

// Initialize the S3 Client for Cloudflare R2
const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const uploadOnR2 = async (localFilePath, folderName = "uploads") => {
    try {
        if (!localFilePath) {
            return null;
        }

        const fileName = path.basename(localFilePath);
        const fileKey = `${folderName}/${fileName}`; // e.g. avatars/filename-1234.jpg
        const fileStream = fs.createReadStream(localFilePath);

        await r2Client.send(new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileKey,
            Body: fileStream,
        }));

        fs.unlinkSync(localFilePath);

        return {
            url: `${process.env.R2_PUBLIC_URL}/${fileKey}`,
            key: fileKey
        };
    } catch (error) {
        console.log("error on r2 upload: ", error);
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return null;
    }
}

const deleteOnR2 = async (fileKey) => {
    try {
        if (!fileKey) return null;

        const response = await r2Client.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileKey,
        }));
        
        console.log("Deleted from R2:", fileKey);
        return response;
    } catch (error) {
        console.log("error on r2 delete: ", error);
        return null;
    }
}

const extractPublicId = (r2Url) => {
    if (!r2Url) return null;

    const publicUrlPrefix = process.env.R2_PUBLIC_URL + "/";
    
    // If the URL contains our public URL, remove it to get the key
    if (r2Url.startsWith(publicUrlPrefix)) {
        return r2Url.replace(publicUrlPrefix, "");
    }

    return null;
}

export { uploadOnR2, deleteOnR2, extractPublicId };