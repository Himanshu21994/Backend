// src/controllers/user.controller.js
import { asyncHandlers } from "../utils/asyncHandlers.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    }catch(err){
        throw new ApiError(500, "Error in generating tokens");
    }
}

const registerUser = asyncHandlers(async (req, res) => {
    // get user details from fronend
    // validation - not empty
    // check if user already exists: username, email
    // check for image, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation success
    // return res


    const { fullName, email, username, password } = req.body;
    console.log( 'email:', email);
    console.log('fullName:', fullName);

    if(
        [fullName, email, username, password].some((field) => 
            field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({ 
        $or: [ { email }, { username } ]
    })

    if(existedUser){
        throw new ApiError(409, "User already exists with this email or username");
    }
    console.log('req.files:', req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0 ){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required");
    }

    // if(!coverImageLocalPath){
    //     throw new ApiError(400, "Cover image is required");
    // }
    

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(500, "Error in uploading avatar image");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,         
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(       // MongoDB me ek naya user insert hota hai
        "-password -refreshToken"                                   // password aur refreshToken ko response se hata do
    )                                                               // createdUser me sirf required fields hi aayengi
                                                                    // - ka matlab exclude karna hai  toh hum -password or -refreshToken exclude kar rahe hain
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

const loginUser = asyncHandlers(async (req, res) => {
    // req.body -> data
    // username or email
    // find the user from db
    // if user exists, password check
    // if password matches, generate access token and refresh token
    // send cookie 

    const { email, username, password } = req.body;

    if(!(email || username)){      // if both are missing -> error
        throw new ApiError(400, "Email or username is required to login");
    }

    const user = await User.findOne({
        $or: [ { email }, { username } ]
    });

    if(!user){
        throw new ApiError(404, "User not found with this email or username");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true,               // only modify over server not by frontend

    }
    
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandlers(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, 
        {
            $set: {
                refreshToken: undefined
            }
        },
        [
            { new: true, select: "-password -refreshToken" }
        ]
    );

    const option = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(
        new ApiResponse(
            200,
            {},
            "User logged out successfully"
        )
    );
})

const refreshAccessToken = asyncHandlers(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    // get refresh token from cookie or body
    // if not present, error
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }

    try {
        // verify the token
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (!decodedToken) {
            throw new ApiError(401, "Invalid refresh token");
        }
        // get user id from payload
        const user = await User.findById(decodedToken?._id)
        
        if(!user){
            throw new ApiError(401, "Invalid refresh token");
        }
    
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id);
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken: newRefreshToken },
                "Access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentUserPassword = asyncHandlers(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Password changed successfully"
        )
    );
});

const getCurrentUser = asyncHandlers(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.user,
                "Current user fetched successfully"
            )
        );
});

const updateAccountDetails = asyncHandlers(async (req, res) => {
    const { fullName,email } = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "Fullname and email are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { 
            $set: { fullName, email }
        },
        { new: true }
    ).select("-password -refreshToken");


    await user.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            user,
            "Account details updated successfully"
        )
    );
});

const updateUserAvatar = asyncHandlers(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    
    if(!avatar.url){
        throw new ApiError(500, "Error in uploading avatar image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { avatar: avatar.url } },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            { avatar: avatar.url },
            "Avatar updated successfully"
        )
    );
});

const updateUserCoverImage = asyncHandlers(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image is required");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(500, "Error in uploading cover image");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { coverImage: coverImage.url } },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            { coverImage: coverImage.url },
            "Cover image updated successfully"
        )
    );
});

const getUserChannelProfile = asyncHandlers(async (req, res) => {
    const { username } = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "Username is required");
    }

    // return value will be array of objects
    const channel = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",          // collection name in db. // every value in model convert to lowercase and becomes plural
                localField: "_id",              // Yeh user ka _id field hai. Matlab, jis user ki profile dekh rahe ho, uska unique id.
                foreignField: "channel",        // "subscriptions" collection mein ek field hai channel. Is field mein user ka id store hota hai, jisko log subscribe karte hain.
                as: "subscribers"               // as: "subscribers" matlab jo matching data milega, usko ek array ke roop mein subscribers naam se user object mein daal dega.
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },   // $size operator se hum array ki length nikal sakte hain
                channelsSubscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},   // $in operator se check karte hain ki kya current logged in user ka id subscribers array mein hai
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                createdAt: 1
            }
        }
    ])   
    
    if(!channel?.length){
        throw new ApiError(404, "Channel does not exist");
    }
    
    return res.status(200).json(
        new ApiResponse(
            200,
            channel[0],    // channel ek array hai jisme ek hi object hoga, toh hum uska pehla element return kar rahe hain
            "User channel profile fetched successfully"
        )
    );

});
 

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentUserPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile
};