import { v2 as cloudinary } from 'cloudinary'
import { log } from 'console';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
}); 
7
const uploadOnCloudinary = async (localFilePath)=> {
    try{
        if(!localFilePath) return null;
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        })
        // file has been uploaded successfully
        // console.log("file is uploaded on cloudinary", response.url);
        fs.unlinkSync(localFilePath); // remove the file from local uploads folder
        return response;
    }catch(err){
        fs.unlinkSync(localFilePath); // remove the file from local uploads folder
        console.log("error in uploading file on cloudinary", err);
        return null;
    }
}

export { uploadOnCloudinary };