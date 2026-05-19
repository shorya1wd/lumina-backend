import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";

cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

const uploadOnCloudinary=async(localFilePath)=>{
    try {

        if(!localFilePath){
            return null
        }

        const response=await cloudinary.uploader.upload(localFilePath,{resource_type:"auto"})

        fs.unlinkSync(localFilePath)

        return response

    } catch (error) {

        console.log("error on cloudinary: ",error)
 
        if(fs.existsSync(localFilePath)){

            fs.unlinkSync(localFilePath)

        }

        return null

    }
}

const deleteFromCloudinary=async(publicId,resourceType="image")=>{
    try {
        const result=await cloudinary.uploader.destroy(publicId,{resource_type:resourceType})
        console.log("Deleted from cloudinary",publicId)
        return result
    } catch (error) {
        console.log("error deleting from cloudinary",error)
        return null
    }
}

const extractPublicId = (cloudinaryUrl) => {
    if (!cloudinaryUrl) return null;

    // 1. Split the URL by slashes
    const parts = cloudinaryUrl.split('/');
    
    // 2. Find the index of the word "upload"
    const uploadIndex = parts.indexOf('upload');

    // 3. The public ID starts AFTER "upload" and the version string ("v123456789")
    // So we slice the array from uploadIndex + 2 to the end, and join it back with slashes
    const publicIdWithExtension = parts.slice(uploadIndex + 2).join('/');

    // 4. Remove the extension (.jpg, .png) safely, even if the filename has dots in it
    const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
    const publicId = publicIdWithExtension.substring(0, lastDotIndex);

    return publicId;
};

export {uploadOnCloudinary,deleteFromCloudinary,extractPublicId}
