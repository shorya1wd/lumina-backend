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

    const parts = cloudinaryUrl.split('/');
    
    const uploadIndex = parts.indexOf('upload');

    const publicIdWithExtension = parts.slice(uploadIndex + 2).join('/');

    const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
    const publicId = publicIdWithExtension.substring(0, lastDotIndex);

    return publicId;
};

export {uploadOnCloudinary,deleteFromCloudinary,extractPublicId}
