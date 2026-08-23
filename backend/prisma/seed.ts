import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const doctorSpecialties = [
  { slug: "general-practitioners", name: "General Practitioners", icon: "🩺" },
  { slug: "cardiologists", name: "Cardiologists", icon: "❤️" },
  { slug: "pediatricians", name: "Pediatricians", icon: "👶" },
  { slug: "dermatologists", name: "Dermatologists", icon: "✨" },
  { slug: "neurologists", name: "Neurologists", icon: "🧠" },
  { slug: "endocrinologists", name: "Endocrinologists", icon: "🩸" },
  { slug: "gastroenterologists", name: "Gastroenterologists", icon: "🧬" },
  { slug: "psychiatrists", name: "Psychiatrists", icon: "🧘" },
  { slug: "orthopedics", name: "Orthopedics", icon: "🦴" },
  { slug: "dentists", name: "Dentists", icon: "🦷" },
  { slug: "ophthalmologists", name: "Ophthalmologists", icon: "👁️" },
  { slug: "gynecologists", name: "Gynecologists", icon: "🌸" },
];

const doctorTemplates: Record<string, Array<{ doctor: string; clinic: string; area: string; lat: number; lng: number; fee: number }>> = {
  "general-practitioners": [
    { doctor: "Dr. Ananya Rao", clinic: "MediCare Family Clinic", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 500 },
    { doctor: "Dr. Vikram Sen", clinic: "CityHealth Family Clinic", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 600 },
    { doctor: "Dr. Sunita Kulkarni", clinic: "PrimeCare Medical Centre", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 550 },
    { doctor: "Dr. Rajesh Khanna", clinic: "Apex Wellness Clinic", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 500 },
    { doctor: "Dr. Meera Deshmukh", clinic: "LifeLine Family Care", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 650 },
    { doctor: "Dr. Alok Tripathi", clinic: "Unity General Clinic", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 450 },
    { doctor: "Dr. Deepa Joshi", clinic: "Swastha Family Care", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 500 },
    { doctor: "Dr. Suresh Pillai", clinic: "Healing Touch Medicals", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 550 },
    { doctor: "Dr. Kavita Banerjee", clinic: "Metro Health Centre", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 600 },
    { doctor: "Dr. Pradeep Sharma", clinic: "CareFirst General Clinic", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 500 },
    { doctor: "Dr. Sangeeta Malhotra", clinic: "Universal Health Clinic", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 550 },
    { doctor: "Dr. Varun Kapoor", clinic: "Harmony General Clinic", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 600 },
  ],
  "cardiologists": [
    { doctor: "Dr. Karan Mehta", clinic: "HeartWise Cardiac Centre", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 1000 },
    { doctor: "Dr. Arvind Swamy", clinic: "Pulse Cardiology Hospital", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 1200 },
    { doctor: "Dr. Ritu Saxena", clinic: "Rhythm Heart Institute", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 1100 },
    { doctor: "Dr. Sanjay Dutt", clinic: "CardioCare Heart Clinic", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 1150 },
    { doctor: "Dr. Archana Reddy", clinic: "BeatCare Cardiac Centre", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 950 },
    { doctor: "Dr. Tushar Saxena", clinic: "Apex Heart Specialty Clinic", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 1050 },
    { doctor: "Dr. Smita Dave", clinic: "LifePulse Cardiac Care", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 1000 },
    { doctor: "Dr. Harish Prasad", clinic: "Supreme Heart Clinic", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 900 },
    { doctor: "Dr. Vandana Rao", clinic: "Crown Cardiac Centre", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 1100 },
    { doctor: "Dr. Manish Pandey", clinic: "Vantage Heart Care", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 1050 },
    { doctor: "Dr. Shalini Hegde", clinic: "CarePulse Cardiology", area: "Rajajinagar, Bengaluru", lat: 12.9982, lng: 77.5530, fee: 1200 },
    { doctor: "Dr. Nikhil Bose", clinic: "Pinnacle Heart Hospital", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 1000 },
  ],
  "pediatricians": [
    { doctor: "Dr. Neha Iyer", clinic: "LittleSprouts Pediatric Hospital", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 700 },
    { doctor: "Dr. Siddharth Roy", clinic: "TinyTots Children Clinic", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 750 },
    { doctor: "Dr. Radhika Nair", clinic: "KinderCare Child Clinic", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 650 },
    { doctor: "Dr. Manoj Kulkarni", clinic: "HappyKids Pediatric Centre", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 600 },
    { doctor: "Dr. Pooja Saxena", clinic: "AngelCare Children Clinic", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 800 },
    { doctor: "Dr. Chetan Patel", clinic: "BrightFutures Child Health", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 700 },
    { doctor: "Dr. Suchitra Bose", clinic: "LittleAngels Clinic", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 650 },
    { doctor: "Dr. Rohit Sen", clinic: "Blossoms Children Hospital", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 750 },
    { doctor: "Dr. Swati Bhat", clinic: "Sunshine Pediatric Clinic", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 700 },
    { doctor: "Dr. Vivek Menon", clinic: "KiddoCare Medical Centre", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 650 },
    { doctor: "Dr. Aarti Shah", clinic: "StarKids Child Clinic", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 800 },
    { doctor: "Dr. Gagan Verma", clinic: "NextGen Pediatric Care", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 750 },
  ],
  "dermatologists": [
    { doctor: "Dr. Ishita Shah", clinic: "GlowSkin Dermatology Clinic", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 800 },
    { doctor: "Dr. Rahul Dravid", clinic: "ClearSkin Derma Centre", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 850 },
    { doctor: "Dr. Sneha Agarwal", clinic: "Aura Dermatology Institute", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 900 },
    { doctor: "Dr. Kunal Kapoor", clinic: "Dermacare Skin Clinic", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 1000 },
    { doctor: "Dr. Preeti Sinha", clinic: "Radiant Skin Specialty Clinic", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 750 },
    { doctor: "Dr. Abhinav Reddy", clinic: "Velvet Skin Care Clinic", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 800 },
    { doctor: "Dr. Priyanka Joshi", clinic: "DermaPulse Aesthetics", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 850 },
    { doctor: "Dr. Tarun Gill", clinic: "SkinPure Clinic", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 700 },
    { doctor: "Dr. Neeti Varma", clinic: "CrystalSkin Dermatology", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 800 },
    { doctor: "Dr. Sandeep Naik", clinic: "Elite Dermatology Centre", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 850 },
    { doctor: "Dr. Malini Rao", clinic: "Renew Skin & Hair Clinic", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 750 },
    { doctor: "Dr. Nitin Ahuja", clinic: "Lumina Derma Care", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 900 },
  ],
  "neurologists": [
    { doctor: "Dr. Rohan Nair", clinic: "NeuroCare Institute", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 1100 },
    { doctor: "Dr. Devendra Sharma", clinic: "Synapse Brain & Spine Centre", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 1300 },
    { doctor: "Dr. Shweta Panday", clinic: "MindPulse Neuro Clinic", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 1200 },
    { doctor: "Dr. Ashok Chakravarthy", clinic: "Apex Neurology Hospital", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 1400 },
    { doctor: "Dr. Rashmi Gupta", clinic: "BrainHealth Specialty Clinic", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 1150 },
    { doctor: "Dr. Vivek Rane", clinic: "NeuroLife Care Centre", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 1250 },
    { doctor: "Dr. Sunayana Paul", clinic: "NerveCare Clinic", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 1100 },
    { doctor: "Dr. Krishnan Nambiar", clinic: "MasterMind Neuro Hospital", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 1050 },
    { doctor: "Dr. Divya Chawla", clinic: "Central Brain Care Clinic", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 1200 },
    { doctor: "Dr. Anand Bhaskar", clinic: "Precise Neuro Institute", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 1150 },
    { doctor: "Dr. Latika Sen", clinic: "Cognition Neurology Centre", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 1000 },
    { doctor: "Dr. Mahesh Shinde", clinic: "Optimal Brain Clinic", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 1350 },
  ],
  "endocrinologists": [
    { doctor: "Dr. Maya Verma", clinic: "Balance Hormone Centre", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 900 },
    { doctor: "Dr. Rakesh Singhania", clinic: "Diabetes & Endocrine Care", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 950 },
    { doctor: "Dr. Nidhi Chhabra", clinic: "Thyroid & Hormone Clinic", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 1000 },
    { doctor: "Dr. Bhaskar Merchant", clinic: "Metabolic Health Institute", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 1050 },
    { doctor: "Dr. Supriya Kamath", clinic: "EndoCare Specialty Clinic", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 850 },
    { doctor: "Dr. Hemant Seth", clinic: "VitalHormone Clinic", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 950 },
    { doctor: "Dr. Bhavna Madhav", clinic: "Glycemia Diabetes Clinic", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 900 },
    { doctor: "Dr. Samarjit Roy", clinic: "Endocrine Wellness Hospital", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 800 },
    { doctor: "Dr. Tanvi Mittal", clinic: "Optimum Endocrinology", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 900 },
    { doctor: "Dr. Yogesh Dave", clinic: "HormoneLine Clinic", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 850 },
    { doctor: "Dr. Richa Saini", clinic: "Diabetes Care Centre", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 800 },
    { doctor: "Dr. Ashwin Nene", clinic: "ProEndo Metabolic Clinic", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 1000 },
  ],
  "gastroenterologists": [
    { doctor: "Dr. Arjun Sethi", clinic: "Digestive Health Clinic", area: "Banaswadi, Bengaluru", lat: 13.0215, lng: 77.6243, fee: 950 },
    { doctor: "Dr. Vijay Raghavan", clinic: "GastroCare Institute", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 1100 },
    { doctor: "Dr. Sushma Swaraj", clinic: "Liver & Digestive Centre", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 1050 },
    { doctor: "Dr. Pravin Jadhav", clinic: "Apex Gut Care Hospital", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 1150 },
    { doctor: "Dr. Shilpa Rao", clinic: "GutHealth Specialty Clinic", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 900 },
    { doctor: "Dr. Deepak Oberoi", clinic: "GastroPulse Institute", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 1000 },
    { doctor: "Dr. Meenakshi Sundaram", clinic: "Advanced Digestive Centre", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 950 },
    { doctor: "Dr. Alok Nanda", clinic: "Digestive Life Care", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 900 },
    { doctor: "Dr. Pallavi Tyagi", clinic: "GastroWellness Clinic", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 850 },
    { doctor: "Dr. Subhash Bose", clinic: "Total Gut Health Clinic", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 950 },
    { doctor: "Dr. Rekha Pillai", clinic: "GastroLine Hospital", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 900 },
    { doctor: "Dr. Umang Vyas", clinic: "Prime GI Clinic", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 1050 },
  ],
  "psychiatrists": [
    { doctor: "Dr. Pooja Menon", clinic: "MindBloom Wellness Centre", area: "Sarjapur Road, Bengaluru", lat: 12.9187, lng: 77.6398, fee: 1200 },
    { doctor: "Dr. Sameer Malhotra", clinic: "Harmony Mind Clinic", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 1300 },
    { doctor: "Dr. Tanushree Das", clinic: "Tranquil Mind Institute", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 1250 },
    { doctor: "Dr. Jayant Deshmukh", clinic: "Serenity Mental Health", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 1400 },
    { doctor: "Dr. Anuradha Prasad", clinic: "InnerPeace Psychiatry Centre", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 1100 },
    { doctor: "Dr. Kazi Rahman", clinic: "Hope Psychiatric Hospital", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 1200 },
    { doctor: "Dr. Smriti Kulkarni", clinic: "MindCare Behavioral Health", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 1150 },
    { doctor: "Dr. Pratyush Sinha", clinic: "Haven Mind Clinic", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 1050 },
    { doctor: "Dr. Ritu Choudhury", clinic: "ZenMind Specialty Clinic", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 1000 },
    { doctor: "Dr. Varun Sundaram", clinic: "Mental Wellness Centre", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 1150 },
    { doctor: "Dr. Nalini Srivastav", clinic: "Cognizant Mind Institute", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 1100 },
    { doctor: "Dr. Girish Pandey", clinic: "Clarity Behavioral Clinic", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 1300 },
  ],
  "orthopedics": [
    { doctor: "Dr. Rajesh Varma", clinic: "JointCare Orthopedic Hospital", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 900 },
    { doctor: "Dr. Amit Shah", clinic: "Bone & Joint Specialty Clinic", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 950 },
    { doctor: "Dr. Sujata Roy", clinic: "Spine & Ortho Health Centre", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 1000 },
    { doctor: "Dr. Vikramaditya Rao", clinic: "Apex Orthopedic Institute", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 1100 },
    { doctor: "Dr. Madhavan Pillai", clinic: "Movement Ortho Clinic", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 850 },
    { doctor: "Dr. Preeti Deshpande", clinic: "OrthoPulse Bone Hospital", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 1050 },
    { doctor: "Dr. Srikant Nair", clinic: "ActiveJoint Orthopedics", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 900 },
    { doctor: "Dr. Chetna Sharma", clinic: "OrthoCare Centre", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 800 },
    { doctor: "Dr. Sandeep Kulkarni", clinic: "Mobility Bone Clinic", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 900 },
    { doctor: "Dr. Anusha Hegde", clinic: "FlexiJoint Hospital", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 950 },
    { doctor: "Dr. Mohit Bansal", clinic: "Precision Ortho Care", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 850 },
    { doctor: "Dr. Vandana Saini", clinic: "Prime Spine & Joint Clinic", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 1000 },
  ],
  "dentists": [
    { doctor: "Dr. Priya Nambiar", clinic: "BrightSmile Dental Clinic", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 500 },
    { doctor: "Dr. Tarun Varma", clinic: "ToothCare Dental Studio", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 600 },
    { doctor: "Dr. Shweta Shetty", clinic: "WhiteDental Specialty Clinic", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 700 },
    { doctor: "Dr. Gautam Gambhir", clinic: "Apex Smiles Dental Hospital", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 550 },
    { doctor: "Dr. Renu Mathur", clinic: "Pearl Dental Care", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 500 },
    { doctor: "Dr. Karthik Raja", clinic: "DentalPulse Studio", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 650 },
    { doctor: "Dr. Sonali Bhagat", clinic: "Crystal Smile Clinic", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 550 },
    { doctor: "Dr. Amol Shinde", clinic: "Perfect Bite Dental", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 450 },
    { doctor: "Dr. Neha Goel", clinic: "Gentle Care Dental", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 500 },
    { doctor: "Dr. Rohit Parashar", clinic: "Sparkle Dental Care", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 600 },
    { doctor: "Dr. Ananya Saxena", clinic: "Elite Smile Care", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 550 },
    { doctor: "Dr. Dhruv Merchant", clinic: "Crown Dental Institute", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 700 },
  ],
  "ophthalmologists": [
    { doctor: "Dr. Sundar Rajan", clinic: "VisionPlus Eye Care Hospital", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 700 },
    { doctor: "Dr. Archana Kulkarni", clinic: "ClearSight Eye Institute", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 800 },
    { doctor: "Dr. Manish Kapoor", clinic: "Apex Vision Centre", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 900 },
    { doctor: "Dr. Deepali Joshi", clinic: "EyeCare Specialty Hospital", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 750 },
    { doctor: "Dr. Nitin Gadkari", clinic: "Optima Eye Clinic", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 650 },
    { doctor: "Dr. Swati Deshmukh", clinic: "Iris Eye Care", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 850 },
    { doctor: "Dr. Raghavendra Rao", clinic: "VisionLine Eye Hospital", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 700 },
    { doctor: "Dr. Pooja Shrivastava", clinic: "SightCare Centre", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 600 },
    { doctor: "Dr. Alok Mehta", clinic: "Lumina Eye Institute", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 750 },
    { doctor: "Dr. Sandhya Sen", clinic: "BrightVision Clinic", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 700 },
    { doctor: "Dr. Varun Merchant", clinic: "Precise Eye Centre", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 650 },
    { doctor: "Dr. Kavita Tripathi", clinic: "Focus Vision Hospital", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 850 },
  ],
  "gynecologists": [
    { doctor: "Dr. Sunita Rao", clinic: "WomanCare Health Clinic", area: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, fee: 800 },
    { doctor: "Dr. Anjali Deshmukh", clinic: "Motherhood Specialty Hospital", area: "Indiranagar, Bengaluru", lat: 12.9719, lng: 77.6412, fee: 900 },
    { doctor: "Dr. Radhika Iyer", clinic: "Blossom Womens Clinic", area: "HSR Layout, Bengaluru", lat: 12.9116, lng: 77.6474, fee: 850 },
    { doctor: "Dr. Meera Nambiar", clinic: "Grace Womens Health", area: "MG Road, Bengaluru", lat: 12.9716, lng: 77.5946, fee: 1000 },
    { doctor: "Dr. Sangeeta Pillai", clinic: "Femina Care Hospital", area: "Jayanagar, Bengaluru", lat: 12.9254, lng: 77.5937, fee: 750 },
    { doctor: "Dr. Priyanka Varma", clinic: "Lotus Womens Clinic", area: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7499, fee: 950 },
    { doctor: "Dr. Deepa Saxena", clinic: "Empress Womens Centre", area: "Hebbal, Bengaluru", lat: 13.0358, lng: 77.5970, fee: 800 },
    { doctor: "Dr. Ritu Malhotra", clinic: "Harmony Gynec Clinic", area: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, fee: 700 },
    { doctor: "Dr. Swati Bose", clinic: "CaringHands Womens Hospital", area: "JP Nagar, Bengaluru", lat: 12.9063, lng: 77.5857, fee: 850 },
    { doctor: "Dr. Aparna Shah", clinic: "Prime Gynec Specialty", area: "Marathahalli, Bengaluru", lat: 12.9592, lng: 77.6974, fee: 800 },
    { doctor: "Dr. Kavita Kulkarni", clinic: "VitalWomens Clinic", area: "BTM Layout, Bengaluru", lat: 12.9166, lng: 77.6101, fee: 750 },
    { doctor: "Dr. Shweta Panday", clinic: "Nova Womens Health", area: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, fee: 900 },
  ],
};

const govtTemplates = [
  {
    name: "Passport Seva Kendra",
    slug: "passport-seva-kendra-koramangala",
    officer: "Officer Suresh Kumar",
    area: "80 Feet Road, Koramangala, Bengaluru",
    desc: "Official Regional Passport Application, Renewal & Tatkaal Counter",
    lat: 12.9352,
    lng: 77.6245,
    services: [
      { name: "Fresh Passport Application Token", fee: 1500, min: 30 },
      { name: "Passport Reissue / Renewal", fee: 1500, min: 25 },
      { name: "Tatkaal Verification Desk", fee: 3500, min: 20 },
    ],
  },
  {
    name: "Regional Transport Office (KA-03)",
    slug: "rto-office-indiranagar",
    officer: "RTO Inspector Ramesh Rao",
    area: "100 Feet Road, Indiranagar, Bengaluru",
    desc: "Motor Vehicle Registration, Drivers License & Fitness Verification",
    lat: 12.9719,
    lng: 77.6412,
    services: [
      { name: "Learners License Slot", fee: 200, min: 20 },
      { name: "Permanent Driving License Test", fee: 500, min: 30 },
      { name: "Vehicle RC Smartcard Token", fee: 600, min: 25 },
    ],
  },
  {
    name: "Aadhaar Seva Kendra",
    slug: "aadhaar-seva-kendra-mg-road",
    officer: "Manager Anitha Reddy",
    area: "Trinity Circle, MG Road, Bengaluru",
    desc: "UIDAI Official Aadhaar Enrolment & Biometric Update Centre",
    lat: 12.9716,
    lng: 77.5946,
    services: [
      { name: "New Aadhaar Enrolment", fee: 0, min: 20 },
      { name: "Biometric Update (Iris/Photo)", fee: 100, min: 15 },
      { name: "Demographic Detail Correction", fee: 50, min: 15 },
    ],
  },
  {
    name: "Sub-Registrar Registration Office",
    slug: "sub-registrar-office-jayanagar",
    officer: "Sub-Registrar Venkat Raman",
    area: "4th Block, Jayanagar, Bengaluru",
    desc: "Property Sale Deed Registration, Marriage License & Stamp Office",
    lat: 12.9254,
    lng: 77.5937,
    services: [
      { name: "Property Sale Deed Slot", fee: 1000, min: 45 },
      { name: "Encumbrance Certificate (EC)", fee: 200, min: 20 },
      { name: "Special Marriage Registration", fee: 500, min: 30 },
    ],
  },
  {
    name: "BBMP Revenue Office",
    slug: "bbmp-revenue-office-hsr",
    officer: "Revenue Officer Prakash Hegde",
    area: "27th Main, HSR Layout, Bengaluru",
    desc: "Municipal Property Tax Assessment, Khata Transfer & Trade Licenses",
    lat: 12.9116,
    lng: 77.6474,
    services: [
      { name: "Property Tax Assessment Slot", fee: 0, min: 20 },
      { name: "E-Khata Transfer Desk", fee: 500, min: 30 },
      { name: "Trade License Inspection Desk", fee: 300, min: 25 },
    ],
  },
  {
    name: "PAN Card Facilitation Centre",
    slug: "pan-card-kendra-whitefield",
    officer: "Officer Kavya Nair",
    area: "ITPL Main Road, Whitefield, Bengaluru",
    desc: "Income Tax Department NSDL/UTITSL Taxpayer Services Desk",
    lat: 12.9698,
    lng: 77.7499,
    services: [
      { name: "New PAN Application", fee: 110, min: 15 },
      { name: "PAN Correction & Reprint", fee: 110, min: 15 },
      { name: "e-Filing Help Desk", fee: 300, min: 30 },
    ],
  },
  {
    name: "Food & Civil Supplies Seva Kendra",
    slug: "civil-supplies-office-hebbal",
    officer: "Inspector Manjunath Swamy",
    area: "Bellary Road, Hebbal, Bengaluru",
    desc: "Ration Card Issuance, Name Correction & BPL/APL Verification",
    lat: 13.0358,
    lng: 77.5970,
    services: [
      { name: "New Ration Card Application", fee: 0, min: 20 },
      { name: "Ration Card Name Addition", fee: 50, min: 15 },
      { name: "Category Verification Desk", fee: 0, min: 20 },
    ],
  },
  {
    name: "BESCOM Electricity Consumer Centre",
    slug: "bescom-office-btm",
    officer: "Executive Engineer Sunil Deshmukh",
    area: "Outer Ring Road, BTM Layout, Bengaluru",
    desc: "Power Connection Sanctions, Meter Testing & Meter Name Transfer",
    lat: 12.9166,
    lng: 77.6101,
    services: [
      { name: "New Power Connection Request", fee: 500, min: 30 },
      { name: "Meter Name Transfer Desk", fee: 250, min: 20 },
      { name: "Tariff Category Inspection", fee: 300, min: 25 },
    ],
  },
  {
    name: "BWSSB Water Supply Board",
    slug: "bwssb-water-board-jp-nagar",
    officer: "Assistant Engineer Raghavan Pillai",
    area: "100 Feet Ring Road, JP Nagar, Bengaluru",
    desc: "Water Connection License, Sanctions & Meter Billing Verification",
    lat: 12.9063,
    lng: 77.5857,
    services: [
      { name: "New Water Connection Token", fee: 500, min: 30 },
      { name: "Water Meter Testing Slot", fee: 200, min: 20 },
      { name: "Sanitary Connection License", fee: 400, min: 25 },
    ],
  },
  {
    name: "FSSAI Food Safety Licensing Office",
    slug: "fssai-office-electronic-city",
    officer: "Safety Officer Divya Menon",
    area: "Phase 1, Electronic City, Bengaluru",
    desc: "Food Business Registration, Safety Audits & Hygiene Certification",
    lat: 12.8399,
    lng: 77.6770,
    services: [
      { name: "Basic Food Business Registration", fee: 100, min: 20 },
      { name: "State Food License Application", fee: 2000, min: 35 },
      { name: "Hygiene Audit Clearance", fee: 500, min: 30 },
    ],
  },
  {
    name: "District Registrar & e-Stamp Centre",
    slug: "district-registrar-marathahalli",
    officer: "Registrar Sanjeev Kapoor",
    area: "Varthur Road, Marathahalli, Bengaluru",
    desc: "e-Stamping Verification, Legal Document Franking & Partnership Desk",
    lat: 12.9592,
    lng: 77.6974,
    services: [
      { name: "e-Stamp Duty Verification Slot", fee: 100, min: 15 },
      { name: "Document Franking Counter", fee: 200, min: 15 },
      { name: "Partnership Deed Registration", fee: 1500, min: 40 },
    ],
  },
  {
    name: "Commercial Taxes & GST Seva Kendra",
    slug: "gst-office-malleshwaram",
    officer: "Tax Officer Vinay Chawla",
    area: "Sampige Road, Malleshwaram, Bengaluru",
    desc: "GST Taxpayer Registration, Certificate Amendment & Audit Helpdesk",
    lat: 13.0031,
    lng: 77.5643,
    services: [
      { name: "New GST Registration Verification", fee: 0, min: 25 },
      { name: "GST Certificate Amendment Slot", fee: 200, min: 20 },
      { name: "Tax Refund Consultation", fee: 0, min: 30 },
    ],
  },
  {
    name: "Employment Exchange & Skill Cell",
    slug: "employment-exchange-rajajinagar",
    officer: "Employment Officer Sharad Malhotra",
    area: "Dr. Rajkumar Road, Rajajinagar, Bengaluru",
    desc: "State Employment Registration, Apprenticeships & Youth Skill Desk",
    lat: 12.9982,
    lng: 77.5530,
    services: [
      { name: "Job Seeker Registration Card", fee: 0, min: 15 },
      { name: "Apprenticeship Program Token", fee: 0, min: 20 },
      { name: "Skill Verification Desk", fee: 0, min: 20 },
    ],
  },
  {
    name: "Citizen Police Verification Centre",
    slug: "police-verification-bannerghatta",
    officer: "Inspector Vijay Kumar",
    area: "Bannerghatta Road, Bengaluru",
    desc: "PCC Clearance Certificate, Tenant Verification & Domestic Help Verification",
    lat: 12.8950,
    lng: 77.5990,
    services: [
      { name: "Police Clearance Certificate (PCC)", fee: 300, min: 20 },
      { name: "Tenant Verification Token", fee: 100, min: 15 },
      { name: "Domestic Help Verification", fee: 100, min: 15 },
    ],
  },
  {
    name: "Senior Citizen & Pension Cell",
    slug: "pension-cell-yelahanka",
    officer: "Welfare Officer Savithri Devi",
    area: "NH 44, Yelahanka New Town, Bengaluru",
    desc: "Senior Citizen Smart Cards, State Pension & Life Certificate Counter",
    lat: 13.1007,
    lng: 77.5963,
    services: [
      { name: "Senior Citizen Smart ID Card", fee: 0, min: 15 },
      { name: "State Pension Application Desk", fee: 0, min: 20 },
      { name: "Jeevan Pramaan Life Certificate", fee: 0, min: 15 },
    ],
  },
];

const restaurantTemplates = [
  {
    name: "Toit Brewpub & Eatery",
    slug: "toit-brewpub-indiranagar",
    cuisine: "Microbrewery, Italian & Woodfired Pizzas",
    desc: "⭐ 4.7 • ₹1,500 for two • Legendary Craft Beer & Woodfired Thin Crust Pizzas • Vibrant Ambience",
    area: "100ft Road, Indiranagar, Bengaluru",
    lat: 12.9792,
    lng: 77.6406,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Windmills Craftworks",
    slug: "windmills-craftworks-whitefield",
    cuisine: "Craft Brewery, Jazz Lounge & Continental",
    desc: "⭐ 4.8 • ₹2,500 for two • Handcrafted Ales, Live Jazz & Gourmet Steaks • Luxury Dining",
    area: "EPIP Zone, Whitefield, Bengaluru",
    lat: 12.9818,
    lng: 77.7289,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Toscano Italian Bistro & Wine Bar",
    slug: "toscano-italian-ubcity",
    cuisine: "Authentic Italian, Gourmet Pasta & Wines",
    desc: "⭐ 4.6 • ₹1,800 for two • Handcrafted Gnocchi, Sourdough Pizzas & Curated Wine Cellar",
    area: "UB City, Vittal Mallya Road, Lavelle Road, Bengaluru",
    lat: 12.9719,
    lng: 77.5958,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "The Rameshwaram Cafe",
    slug: "the-rameshwaram-cafe-indiranagar",
    cuisine: "Authentic South Indian & Ghee Podi Delicacies",
    desc: "⭐ 4.9 • ₹350 for two • Iconic Ghee Podi Tatte Idli, Crisp Butter Dosas & Strong Filter Coffee",
    area: "12th Main, Indiranagar, Bengaluru",
    lat: 12.9719,
    lng: 77.6412,
    hasBreakfast: true,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Farzi Cafe Modern Indian",
    slug: "farzi-cafe-lavelle-road",
    cuisine: "Modern Indian & Molecular Gastronomy",
    desc: "⭐ 4.5 • ₹2,000 for two • Avant-Garde Indian Cuisine, Molecular Cocktails & High Energy Vibes",
    area: "UB City, Lavelle Road, Bengaluru",
    lat: 12.9716,
    lng: 77.5960,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Brahma Brews Garden Brewery",
    slug: "brahma-brews-jp-nagar",
    cuisine: "Open-Air Microbrewery, Pan-Asian & Pizzas",
    desc: "⭐ 4.7 • ₹1,600 for two • Serene Water Body & Lush Garden Seating with Fresh Craft Beer",
    area: "24th Main, JP Nagar 7th Phase, Bengaluru",
    lat: 12.8940,
    lng: 77.5855,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Burma Burma Restaurant & Tea Room",
    slug: "burma-burma-indiranagar",
    cuisine: "Pure Veg Burmese & Artisanal Teas",
    desc: "⭐ 4.8 • ₹1,400 for two • Award-Winning Khow Suey, Tea Leaf Salad & Lotus Root Crisps",
    area: "100ft Road, Indiranagar, Bengaluru",
    lat: 12.9715,
    lng: 77.6410,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Shiro Pan-Asian & Lounge",
    slug: "shiro-pan-asian-ubcity",
    cuisine: "Japanese, Teppanyaki, Dimsums & Sushi",
    desc: "⭐ 4.6 • ₹3,000 for two • Grand High-Ceiling Dining, Zen Waterfalls & Premium Sushi Platters",
    area: "Level 2, UB City, Vittal Mallya Road, Bengaluru",
    lat: 12.9718,
    lng: 77.5955,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: false,
    hasDinner: true,
  },
  {
    name: "Stories - Chapter 2 Rooftop Bar",
    slug: "stories-chapter-2-btm",
    cuisine: "Lush Green Rooftop, Cocktails & Global Fare",
    desc: "⭐ 4.5 • ₹1,200 for two • 4-Floor Vertical Garden Rooftop with City Sunset Views & Craft Brews",
    area: "Outer Ring Road, BTM Layout, Bengaluru",
    lat: 12.9166,
    lng: 77.6101,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Karavalli Coastal Seafood",
    slug: "karavalli-residency-road",
    cuisine: "Mangalorean, Kerala & Coastal Heritage",
    desc: "⭐ 4.9 • ₹3,500 for two • Iconic Coastal Seafood, Crab Ghee Roast & Alleppey Fish Curry",
    area: "Taj Gateway, Residency Road, Bengaluru",
    lat: 12.9695,
    lng: 77.6045,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: false,
    hasDinner: true,
  },
  {
    name: "Nagarjuna Andhra Dining",
    slug: "nagarjuna-residency-road",
    cuisine: "Authentic Andhra Meals, Biryani & Guntur Chicken",
    desc: "⭐ 4.6 • ₹700 for two • Traditional Banana Leaf Andhra Thalis & Fiery Andhra Chicken Fry",
    area: "Residency Road, Bengaluru",
    lat: 12.9710,
    lng: 77.6050,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: false,
    hasDinner: true,
  },
  {
    name: "Olive Beach Mediterranean Villa",
    slug: "olive-beach-ashok-nagar",
    cuisine: "Mediterranean, European Fine Dining & Cocktails",
    desc: "⭐ 4.8 • ₹2,800 for two • Whitewashed Grecian Villa, Romantic Sunlit Courtyard & Seafood",
    area: "Wood Street, Ashok Nagar, Bengaluru",
    lat: 12.9680,
    lng: 77.6080,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Byg Brewski Brewing Company",
    slug: "byg-brewski-sarjapur",
    cuisine: "Open-Air Microbrewery, Woodfired Grills & Asian",
    desc: "⭐ 4.7 • ₹1,800 for two • Asia's Largest Open-Air Brewery with Majestic Amphitheatre & Koi Pond",
    area: "Sarjapur Road, Hennur & Bellandur Hub, Bengaluru",
    lat: 12.9125,
    lng: 77.6740,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Smoke House Deli & All-Day Cafe",
    slug: "smoke-house-deli-lavelle-road",
    cuisine: "European Deli, All-Day Breakfast & Artisan Salads",
    desc: "⭐ 4.5 • ₹1,600 for two • Hand-Drawn Illustrated Decor, Fluffy Pancakes & Signature Burgers",
    area: "Lavelle Road, Shanthala Nagar, Bengaluru",
    lat: 12.9712,
    lng: 77.5975,
    hasBreakfast: true,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Vidyarthi Bhavan Heritage",
    slug: "vidyarthi-bhavan-gandhi-bazaar",
    cuisine: "Heritage South Indian, Crispy Masala Dosa",
    desc: "⭐ 4.8 • ₹250 for two • Iconic 1943 Heritage Eatery famous for Golden Crisp Butter Masala Dosas",
    area: "Gandhi Bazaar Main Road, Basavanagudi, Bengaluru",
    lat: 12.9450,
    lng: 77.5710,
    hasBreakfast: true,
    hasLunch: false,
    hasHiTea: true,
    hasDinner: false,
  },
  {
    name: "Truffles American Diner & Cafe",
    slug: "truffles-cafe-koramangala",
    cuisine: "Gourmet Burgers, Steaks & American Diner",
    desc: "⭐ 4.7 • ₹650 for two • Bengaluru's Favorite Juicy Burgers, Peri Peri Chicken & Thick Shakes",
    area: "5th Block, Koramangala, Bengaluru",
    lat: 12.9345,
    lng: 77.6210,
    hasBreakfast: true,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Oia Grecian Rooftop & Sunset Bar",
    slug: "oia-rooftop-hennur",
    cuisine: "Santorini-Themed Grecian Rooftop, Cocktails & Global",
    desc: "⭐ 4.7 • ₹2,200 for two • Breathtaking Santorini Blue & White Architecture with Sunset Pool",
    area: "Hennur Main Road, Bengaluru",
    lat: 13.0450,
    lng: 77.6430,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "MTR 1924 (Mavalli Tiffin Room)",
    slug: "mtr-1924-lalbagh",
    cuisine: "Legendary South Indian Breakfast & Rava Idli",
    desc: "⭐ 4.9 • ₹300 for two • Centenary Heritage Brand, Inventors of Rava Idli & Royal Karnataka Thali",
    area: "Lalbagh Fort Road, Basavanagudi, Bengaluru",
    lat: 12.9555,
    lng: 77.5840,
    hasBreakfast: true,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Chianti Ristorante Italiano & Wine Bar",
    slug: "chianti-ristorante-koramangala",
    cuisine: "Tuscan Italian, Hand-Rolled Pasta & Woodfired Crust",
    desc: "⭐ 4.7 • ₹1,800 for two • Authentic Italian Antipasti, Handcrafted Ravioli & Tiramisu",
    area: "5th Block, Koramangala, Bengaluru",
    lat: 12.9350,
    lng: 77.6235,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: false,
    hasDinner: true,
  },
  {
    name: "Ironhill Lakeside Microbrewery",
    slug: "ironhill-bengaluru-marathahalli",
    cuisine: "Microbrewery, Global Comfort Food & Grills",
    desc: "⭐ 4.6 • ₹1,700 for two • Expansive Waterfront Brewery with Craft Cider & Gourmet Pizzas",
    area: "Outer Ring Road, Marathahalli, Bengaluru",
    lat: 12.9560,
    lng: 77.6980,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Rim Naam by The Oberoi",
    slug: "rim-naam-the-oberoi-mg-road",
    cuisine: "Royal Thai Fine Dining & Al Fresco Pavilion",
    desc: "⭐ 4.9 • ₹3,800 for two • Set Amidst Lush Rain Trees & Lotus Pond with Royal Thai Flavors",
    area: "The Oberoi, 37-39 MG Road, Bengaluru",
    lat: 12.9725,
    lng: 77.6185,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: false,
    hasDinner: true,
  },
  {
    name: "Sattvam Pure Veg Royal Dining",
    slug: "sattvam-pure-veg-sadashivnagar",
    cuisine: "Sattvic Pure Veg, Royal Buffet & Indian Thalis",
    desc: "⭐ 4.7 • ₹1,100 for two • Pure Vegetarian Royal Sattvic Feast with Over 60 Gourmet Dishes",
    area: "Sankey Road, Sadashivnagar, Bengaluru",
    lat: 13.0070,
    lng: 77.5810,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: false,
    hasDinner: true,
  },
  {
    name: "Daddy Cocktail Lounge & Rooftop",
    slug: "daddy-cocktail-lounge-indiranagar",
    cuisine: "Modern Casual Dining, Craft Cocktails & Lounge",
    desc: "⭐ 4.6 • ₹1,400 for two • Quirky Pop Art Interiors, Rooftop Dining & World Tapas",
    area: "12th Main, HAL 2nd Stage, Indiranagar, Bengaluru",
    lat: 12.9710,
    lng: 77.6415,
    hasBreakfast: false,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
  {
    name: "Glen's Bakehouse & European Bistro",
    slug: "glens-bakehouse-lavelle-road",
    cuisine: "European Bistro, All-Day Breakfast & Bakery",
    desc: "⭐ 4.7 • ₹800 for two • Famous Signature Red Velvet Mini Cupcakes, Sourdough Pizzas & Coffee",
    area: "Lavelle Road, Shanthala Nagar, Bengaluru",
    lat: 12.9705,
    lng: 77.5985,
    hasBreakfast: true,
    hasLunch: true,
    hasHiTea: true,
    hasDinner: true,
  },
];

const salonTemplates = [
  {
    name: "Bodycraft Salon, Spa & Clinic",
    slug: "bodycraft-indiranagar",
    specialty: "Hair Styling, Aesthetic Skin & Luxury Wellness",
    desc: "⭐ 4.8 • Premier Luxury Salon • Kérastase Hair Rituals, Hydra-Facials & Swedish Body Spa",
    area: "100ft Road, Indiranagar, Bengaluru",
    lat: 12.9730,
    lng: 77.6405,
    gender: "Unisex",
  },
  {
    name: "Toni & Guy Essensuals",
    slug: "toni-and-guy-lavelle-road",
    specialty: "British Precision Haircuts, Balayage & Keratin",
    desc: "⭐ 4.7 • International UK Hair Brand • Creative Coloring, Highlights & Global Texture",
    area: "Lavelle Road, Shanthala Nagar, Bengaluru",
    lat: 12.9715,
    lng: 77.5970,
    gender: "Unisex",
  },
  {
    name: "Enrich Beauty & Wellness",
    slug: "enrich-salon-koramangala",
    specialty: "Skin Hydra-Facials, Hair Spa & Manicures",
    desc: "⭐ 4.6 • Complete Head-to-Toe Beauty • Dermalogica Facials, Olaplex & Spa Pedicures",
    area: "5th Block, Koramangala, Bengaluru",
    lat: 12.9348,
    lng: 77.6225,
    gender: "Unisex",
  },
  {
    name: "Bounce Style Lounge & Spa",
    slug: "bounce-salon-mg-road",
    specialty: "Celebrity Stylists, Global Color & Texture",
    desc: "⭐ 4.8 • High-Fashion Hair Lounge • L'Oréal Colour Trophy Winners & Couture Hair Styling",
    area: "MG Road, Craig Park Layout, Bengaluru",
    lat: 12.9720,
    lng: 77.6110,
    gender: "Unisex",
  },
  {
    name: "Truefitt & Hill Luxury Barbershop",
    slug: "truefitt-and-hill-indiranagar",
    specialty: "Royal Shave, Men's Classic Grooming & Haircuts",
    desc: "⭐ 4.9 • World's Oldest Royal Barbershop (Est. 1805) • Hot Towel Shaves & Beard Sculpting",
    area: "12th Main, HAL 2nd Stage, Indiranagar, Bengaluru",
    lat: 12.9708,
    lng: 77.6418,
    gender: "Men's Barbershop",
  },
  {
    name: "Aveda Luxury Day Spa & Salon",
    slug: "aveda-spa-sadashivnagar",
    specialty: "Organic Botanicals & Ayurvedic Spa Therapies",
    desc: "⭐ 4.8 • Plant-Powered Holistic Care • Essential Oil Aromatherapy & Botanical Hair Spa",
    area: "Bashyam Circle, Sadashivnagar, Bengaluru",
    lat: 13.0080,
    lng: 77.5805,
    gender: "Luxury Day Spa",
  },
  {
    name: "YLG (You Look Great) Salon",
    slug: "ylg-salon-hsr-layout",
    specialty: "Signature Waxing, Brightening Facials & Hair Spa",
    desc: "⭐ 4.5 • Premium Women's Beauty Care • European Waxing, Moroccan Hair Spas & De-tan",
    area: "27th Main, HSR Layout Sector 1, Bengaluru",
    lat: 12.9120,
    lng: 77.6470,
    gender: "Women's Salon",
  },
  {
    name: "Green Trends Unisex Hair & Beauty",
    slug: "green-trends-jp-nagar",
    specialty: "Trendy Hair Makeovers, Keratin & De-tan",
    desc: "⭐ 4.5 • Affordable Professional Styling • Trend-setting Haircuts & Charcoal Skin Care",
    area: "24th Main, JP Nagar 5th Phase, Bengaluru",
    lat: 12.9050,
    lng: 77.5890,
    gender: "Unisex",
  },
  {
    name: "Juice Hair Salon & Nail Lounge",
    slug: "juice-salon-church-street",
    specialty: "Creative Hair Color, Gel Nails & Nail Art",
    desc: "⭐ 4.7 • Hip Downtown Styling Studio • Rainbow Highlights, Sassy Balayage & Gel Extensions",
    area: "Church Street, Ashok Nagar, Bengaluru",
    lat: 12.9745,
    lng: 77.6030,
    gender: "Unisex",
  },
  {
    name: "Jean-Claude Biguine Paris (JCB)",
    slug: "jcb-paris-lavelle-road",
    specialty: "French Luxury Hair Styling & Pedicures",
    desc: "⭐ 4.8 • Haute Coiffure Française • Expert French Balayage, Kérastase Fusio-Dose & Spa",
    area: "Lavelle Road, Bengaluru",
    lat: 12.9710,
    lng: 77.5965,
    gender: "Unisex",
  },
  {
    name: "Siddha Wellness & Ayurvedic Day Spa",
    slug: "siddha-ayurvedic-spa-indiranagar",
    specialty: "Abhyanga Herbal Massage & Shirodhara",
    desc: "⭐ 4.9 • Authentic Traditional Kerala Ayurveda • Medicated Herbal Oils & Stress Detox",
    area: "80ft Road, Indiranagar, Bengaluru",
    lat: 12.9750,
    lng: 77.6450,
    gender: "Luxury Day Spa",
  },
  {
    name: "Play Salon & Spa",
    slug: "play-salon-ubcity",
    specialty: "Kérastase Hair Rituals & OPI Nail Extensions",
    desc: "⭐ 4.7 • Bespoke Luxury Grooming • Micro-Mist Hair Therapies & Executive Facials",
    area: "Level 1, UB City, Vittal Mallya Road, Bengaluru",
    lat: 12.9718,
    lng: 77.5956,
    gender: "Unisex",
  },
  {
    name: "Kapil's Salon & Academy",
    slug: "kapils-salon-marathahalli",
    specialty: "Hair Smoothening, Highlights & Bridal Makeup",
    desc: "⭐ 4.5 • Master Hair Colorists • Nanoplastia Hair Treatments & HD Airbrush Makeup",
    area: "Outer Ring Road, Marathahalli, Bengaluru",
    lat: 12.9550,
    lng: 77.6990,
    gender: "Unisex",
  },
  {
    name: "The Barber Club Premium",
    slug: "the-barber-club-koramangala",
    specialty: "Beard Sculpting, Charcoal Facials & Haircuts",
    desc: "⭐ 4.7 • Modern Gentleman's Barbershop • Straight Razor Shaves & Scalp Detox Massages",
    area: "4th Block, Koramangala, Bengaluru",
    lat: 12.9330,
    lng: 77.6250,
    gender: "Men's Barbershop",
  },
  {
    name: "Naturals Ayur & Unisex Salon",
    slug: "naturals-salon-electronic-city",
    specialty: "Ayurvedic Hair Treatments & Herbal Facials",
    desc: "⭐ 4.5 • India's Trusted Beauty Brand • Fruit Glow Facials & Natural Keratin Smoothening",
    area: "Phase 1, Electronic City, Bengaluru",
    lat: 12.8400,
    lng: 77.6765,
    gender: "Unisex",
  },
  {
    name: "Blush & Glow Luxury Nail & Lash Studio",
    slug: "blush-and-glow-indiranagar",
    specialty: "Acrylic Nails, Russian Manicure & Lash Extensions",
    desc: "⭐ 4.8 • Premium Nail & Lash Boutique • Polygel Overlays, Ombre Nail Art & Volume Lashes",
    area: "100ft Road, Indiranagar, Bengaluru",
    lat: 12.9720,
    lng: 77.6415,
    gender: "Women's Salon",
  },
  {
    name: "Bravado Luxury Men's Grooming Lounge",
    slug: "bravado-grooming-hsr-layout",
    specialty: "Executive Haircuts & Scalp Detox",
    desc: "⭐ 4.8 • Speakeasy-Style Barbershop • Beard Fade Styling, Charcoal Peel & Head Massages",
    area: "Sector 3, HSR Layout, Bengaluru",
    lat: 12.9110,
    lng: 77.6480,
    gender: "Men's Barbershop",
  },
  {
    name: "Ananda Day Spa & Holistic Therapy",
    slug: "ananda-day-spa-ashok-nagar",
    specialty: "Swedish Deep Tissue & Body Polishing",
    desc: "⭐ 4.9 • Sanctuary of Peace • Warm Stone Massages, Chocolate Body Scrubs & Foot Spa",
    area: "Residency Road, Ashok Nagar, Bengaluru",
    lat: 12.9700,
    lng: 77.6060,
    gender: "Luxury Day Spa",
  },
  {
    name: "Femina Flaunt Studio Salon",
    slug: "femina-flaunt-jayanagar",
    specialty: "Couture Hair Styling & HD Bridal Glow",
    desc: "⭐ 4.6 • Backed by Femina • Global Runway Hair Colors, Sea Mineral Facials & Blowouts",
    area: "11th Main, 4th Block, Jayanagar, Bengaluru",
    lat: 12.9260,
    lng: 77.5930,
    gender: "Unisex",
  },
  {
    name: "O2 Spa & Wellness Oasis",
    slug: "o2-spa-whitefield",
    specialty: "Aromatherapy & Balinese Full Body Massage",
    desc: "⭐ 4.7 • International Luxury Spa Chain • Aromatherapy Oils, Balinese Strokes & Herbal Steam",
    area: "ITPL Main Road, Whitefield, Bengaluru",
    lat: 12.9860,
    lng: 77.7310,
    gender: "Luxury Day Spa",
  },
  {
    name: "Looks Salon",
    slug: "looks-salon-koramangala",
    specialty: "L'Oréal Professionnel Styling & Olaplex",
    desc: "⭐ 4.6 • Top Celebrity Hairstylists • Balayage, Keratin Infusions & Luxury Hydra-Facials",
    area: "Forum Mall, Koramangala, Bengaluru",
    lat: 12.9360,
    lng: 77.6120,
    gender: "Unisex",
  },
  {
    name: "Glamour & Glitz Bridal Studio",
    slug: "glamour-glitz-malleshwaram",
    specialty: "HD Bridal Makeup & Pre-Bridal Glow",
    desc: "⭐ 4.8 • Bridal Destination Studio • 3D Airbrush Makeup, Saree Draping & 24K Gold Facials",
    area: "8th Cross, Margosa Road, Malleshwaram, Bengaluru",
    lat: 13.0035,
    lng: 77.5680,
    gender: "Women's Salon",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // 1. Ensure parent doctor-appointment and non-doctor categories exist
  await prisma.category.upsert({
    where: { slug: "doctor-appointment" },
    update: {},
    create: { name: "Doctor Appointment", slug: "doctor-appointment", icon: "🩺" },
  });

  await prisma.category.upsert({
    where: { slug: "salon" },
    update: {},
    create: { name: "Salon", slug: "salon", icon: "💇" },
  });

  await prisma.category.upsert({
    where: { slug: "restaurant" },
    update: {},
    create: { name: "Restaurant", slug: "restaurant", icon: "🍽️" },
  });

  await prisma.category.upsert({
    where: { slug: "government-office" },
    update: {},
    create: { name: "Government Office", slug: "government-office", icon: "🏛️" },
  });

  // 2. Upsert all medical specialty categories
  for (const spec of doctorSpecialties) {
    await prisma.category.upsert({
      where: { slug: spec.slug },
      update: { name: spec.name, icon: spec.icon },
      create: spec,
    });
  }

  // 3. Seed demo customer
  const customer = await prisma.user.upsert({
    where: { email: "customer@test.com" },
    update: {},
    create: { name: "Test Customer", email: "customer@test.com", passwordHash, role: "CUSTOMER" },
  });

  let totalClinicsSeeded = 0;

  // 4. Seed 12 clinics per doctor specialty
  for (const spec of doctorSpecialties) {
    const category = await prisma.category.findUnique({ where: { slug: spec.slug } });
    if (!category) continue;

    const templates = doctorTemplates[spec.slug] || [];
    for (let i = 0; i < templates.length; i++) {
      const item = templates[i];
      const slug = `${spec.slug}-clinic-${i + 1}`;
      const ownerEmail = `${slug}-admin@test.com`;
      const doctorEmail = `${slug}-doc@test.com`;

      const owner = await prisma.user.upsert({
        where: { email: ownerEmail },
        update: {},
        create: {
          name: `${item.clinic} Admin`,
          email: ownerEmail,
          passwordHash,
          role: "ADMIN",
        },
      });

      const business = await prisma.business.upsert({
        where: { slug: slug },
        update: {
          name: item.clinic,
          description: `${item.doctor} • ${spec.name} Specialist`,
          address: item.area,
          latitude: item.lat,
          longitude: item.lng,
          categoryId: category.id,
        },
        create: {
          name: item.clinic,
          slug: slug,
          ownerId: owner.id,
          categoryId: category.id,
          description: `${item.doctor} • ${spec.name} Specialist`,
          address: item.area,
          latitude: item.lat,
          longitude: item.lng,
        },
      });

      await prisma.businessHours.deleteMany({ where: { businessId: business.id } });
      await prisma.businessHours.createMany({
        data: [1, 2, 3, 4, 5].map((day) => ({
          businessId: business.id,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "18:00",
        })),
      });

      const doctorUser = await prisma.user.upsert({
        where: { email: doctorEmail },
        update: { name: item.doctor },
        create: {
          name: item.doctor,
          email: doctorEmail,
          passwordHash,
          role: "STAFF",
        },
      });

      const staff = await prisma.staffProfile.upsert({
        where: { userId: doctorUser.id },
        update: { title: item.doctor },
        create: {
          userId: doctorUser.id,
          businessId: business.id,
          title: item.doctor,
        },
      });

      const service = await prisma.service.findFirst({ where: { businessId: business.id, name: "Consultation" } });
      const consultationService =
        service ??
        (await prisma.service.create({
          data: {
            businessId: business.id,
            name: "Consultation",
            description: `General Consultation with ${item.doctor}`,
            durationMin: 30,
            price: item.fee,
            tokenFee: 50.00,
          },
        }));

      // Always delete and regenerate slots from today so the timeframe stays current.
      // For token-based queue, one slot per working day is sufficient (no time-picking).
      await prisma.slot.deleteMany({ where: { staffId: staff.id, isBooked: false } });
      const slots = [];
      const today = new Date();
      for (let d = 0; d < 14; d++) {
        const day = new Date(today);
        day.setDate(day.getDate() + d);
        if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends

        const slotStart = new Date(day);
        slotStart.setHours(9, 0, 0, 0);
        const slotEnd = new Date(day);
        slotEnd.setHours(18, 0, 0, 0);

        // One queue-slot per working day
        slots.push({
          staffId: staff.id,
          serviceId: consultationService.id,
          startTime: slotStart,
          endTime: slotEnd,
        });
      }
      await prisma.slot.createMany({ data: slots, skipDuplicates: true });

      totalClinicsSeeded++;
    }
  }

  // 5. Seed 15 Government Offices under government-office category
  const govtCat = await prisma.category.findUnique({ where: { slug: "government-office" } });
  let totalGovtSeeded = 0;
  if (govtCat) {
    for (const g of govtTemplates) {
      const ownerEmail = `${g.slug}-admin@test.com`;
      const staffEmail = `${g.slug}-officer@test.com`;

      const owner = await prisma.user.upsert({
        where: { email: ownerEmail },
        update: {},
        create: {
          name: `${g.name} Admin`,
          email: ownerEmail,
          passwordHash,
          role: "ADMIN",
        },
      });

      const business = await prisma.business.upsert({
        where: { slug: g.slug },
        update: {
          name: g.name,
          description: `${g.officer} • ${g.desc}`,
          address: g.area,
          latitude: g.lat,
          longitude: g.lng,
          categoryId: govtCat.id,
        },
        create: {
          name: g.name,
          slug: g.slug,
          ownerId: owner.id,
          categoryId: govtCat.id,
          description: `${g.officer} • ${g.desc}`,
          address: g.area,
          latitude: g.lat,
          longitude: g.lng,
        },
      });

      await prisma.businessHours.deleteMany({ where: { businessId: business.id } });
      await prisma.businessHours.createMany({
        data: [1, 2, 3, 4, 5].map((day) => ({
          businessId: business.id,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "17:00",
        })),
      });

      const officerUser = await prisma.user.upsert({
        where: { email: staffEmail },
        update: { name: g.officer },
        create: {
          name: g.officer,
          email: staffEmail,
          passwordHash,
          role: "STAFF",
        },
      });

      const staff = await prisma.staffProfile.upsert({
        where: { userId: officerUser.id },
        update: { title: g.officer },
        create: {
          userId: officerUser.id,
          businessId: business.id,
          title: g.officer,
        },
      });

      for (const s of g.services) {
        let service = await prisma.service.findFirst({ where: { businessId: business.id, name: s.name } });
        if (!service) {
          service = await prisma.service.create({
            data: {
              businessId: business.id,
              name: s.name,
              description: `${s.name} at ${g.name}`,
              durationMin: s.min,
              price: s.fee,
              tokenFee: 50.00,
            },
          });
        }

        // Always delete and regenerate slots from today so the timeframe stays current.
        // For token-based queue, one slot per working day is sufficient.
        await prisma.slot.deleteMany({ where: { staffId: staff.id, serviceId: service.id, isBooked: false } });
        const slots = [];
        const today = new Date();
        for (let d = 0; d < 14; d++) {
          const day = new Date(today);
          day.setDate(day.getDate() + d);
          if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends

          const slotStart = new Date(day);
          slotStart.setHours(9, 0, 0, 0);
          const slotEnd = new Date(day);
          slotEnd.setHours(17, 0, 0, 0);

          // One queue-slot per working day
          slots.push({
            staffId: staff.id,
            serviceId: service.id,
            startTime: slotStart,
            endTime: slotEnd,
          });
        }
        await prisma.slot.createMany({ data: slots, skipDuplicates: true });
      }

      totalGovtSeeded++;
    }
  }

  // 6. Seed 24 Restaurants under restaurant category with time-based meal session slots
  const restaurantCat = await prisma.category.findUnique({ where: { slug: "restaurant" } });
  let totalRestaurantsSeeded = 0;
  if (restaurantCat) {
    const tableServiceDefs = [
      { name: "Table for 2 (Couple / Intimate)", desc: "Reserved table for 2 guests", min: 90, fee: 0, token: 50.00 },
      { name: "Table for 4 (Family & Friends)", desc: "Reserved table for up to 4 guests", min: 90, fee: 0, token: 50.00 },
      { name: "Table for 6+ (Large Group)", desc: "Reserved large dining table for 6+ guests", min: 120, fee: 0, token: 50.00 },
      { name: "Rooftop / Outdoor Seating", desc: "Prime open-air rooftop / al fresco table", min: 90, fee: 0, token: 50.00 },
    ];

    for (const r of restaurantTemplates) {
      const ownerEmail = `${r.slug}-admin@test.com`;
      const staffEmail = `${r.slug}-host@test.com`;

      const owner = await prisma.user.upsert({
        where: { email: ownerEmail },
        update: {},
        create: {
          name: `${r.name} Admin`,
          email: ownerEmail,
          passwordHash,
          role: "ADMIN",
        },
      });

      const business = await prisma.business.upsert({
        where: { slug: r.slug },
        update: {
          name: r.name,
          description: `${r.cuisine} • ${r.desc}`,
          address: r.area,
          latitude: r.lat,
          longitude: r.lng,
          categoryId: restaurantCat.id,
        },
        create: {
          name: r.name,
          slug: r.slug,
          ownerId: owner.id,
          categoryId: restaurantCat.id,
          description: `${r.cuisine} • ${r.desc}`,
          address: r.area,
          latitude: r.lat,
          longitude: r.lng,
        },
      });

      await prisma.businessHours.deleteMany({ where: { businessId: business.id } });
      await prisma.businessHours.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          businessId: business.id,
          dayOfWeek: day,
          startTime: r.hasBreakfast ? "08:00" : "11:30",
          endTime: "23:30",
        })),
      });

      const hostUser = await prisma.user.upsert({
        where: { email: staffEmail },
        update: { name: `${r.name} Host` },
        create: {
          name: `${r.name} Host`,
          email: staffEmail,
          passwordHash,
          role: "STAFF",
        },
      });

      const staff = await prisma.staffProfile.upsert({
        where: { userId: hostUser.id },
        update: { title: "Table Reservation Manager" },
        create: {
          userId: hostUser.id,
          businessId: business.id,
          title: "Table Reservation Manager",
        },
      });

      // Seed table services and time-session slots
      for (const t of tableServiceDefs) {
        let service = await prisma.service.findFirst({ where: { businessId: business.id, name: t.name } });
        if (!service) {
          service = await prisma.service.create({
            data: {
              businessId: business.id,
              name: t.name,
              description: `${t.desc} at ${r.name}`,
              durationMin: t.min,
              price: t.fee,
              tokenFee: t.token,
            },
          });
        }

        await prisma.slot.deleteMany({ where: { staffId: staff.id, serviceId: service.id, isBooked: false } });

        const slots = [];
        const today = new Date();

        // Meal Session Hours:
        const sessionHours: Array<{ h: number; m: number }> = [];
        if (r.hasBreakfast) {
          sessionHours.push({ h: 8, m: 0 }, { h: 8, m: 30 }, { h: 9, m: 0 }, { h: 9, m: 30 }, { h: 10, m: 0 }, { h: 10, m: 30 }, { h: 11, m: 0 });
        }
        if (r.hasLunch) {
          sessionHours.push({ h: 12, m: 0 }, { h: 12, m: 30 }, { h: 13, m: 0 }, { h: 13, m: 30 }, { h: 14, m: 0 }, { h: 14, m: 30 }, { h: 15, m: 0 });
        }
        if (r.hasHiTea) {
          sessionHours.push({ h: 16, m: 0 }, { h: 16, m: 30 }, { h: 17, m: 0 }, { h: 17, m: 30 }, { h: 18, m: 0 });
        }
        if (r.hasDinner) {
          sessionHours.push({ h: 19, m: 0 }, { h: 19, m: 30 }, { h: 20, m: 0 }, { h: 20, m: 30 }, { h: 21, m: 0 }, { h: 21, m: 30 }, { h: 22, m: 0 }, { h: 22, m: 30 });
        }

        for (let d = 0; d < 14; d++) {
          const day = new Date(today);
          day.setDate(day.getDate() + d);

          for (const s of sessionHours) {
            const slotStart = new Date(day);
            slotStart.setHours(s.h, s.m, 0, 0);
            const slotEnd = new Date(slotStart.getTime() + t.min * 60000);

            slots.push({
              staffId: staff.id,
              serviceId: service.id,
              startTime: slotStart,
              endTime: slotEnd,
            });
          }
        }

        await prisma.slot.createMany({ data: slots, skipDuplicates: true });
      }

      totalRestaurantsSeeded++;
    }
  }

  // 7. Seed 22 Salons & Spas under salon category with time-based stylist slots
  const salonCat = await prisma.category.findUnique({ where: { slug: "salon" } });
  let totalSalonsSeeded = 0;
  if (salonCat) {
    const salonServiceDefs = [
      { name: "Signature Haircut, Wash & Blowdry", desc: "Precision haircut, scalp massage & blowdry styling", min: 45, fee: 850, token: 50.00 },
      { name: "Kérastase Luxury Hair Spa & Scalp Therapy", desc: "Deep nourishing ritual with micro-mist steam", min: 60, fee: 1800, token: 50.00 },
      { name: "Hydra-Infusion Deep Cleansing Glow Facial", desc: "Aesthetic skin renewal, blackhead extraction & cooling mask", min: 60, fee: 2200, token: 50.00 },
      { name: "Luxury Spa Pedicure & OPI Gel Manicure", desc: "Dead skin exfoliation, foot reflexology & long-stay gel polish", min: 60, fee: 1200, token: 50.00 },
      { name: "Swedish Full Body Deep Tissue Spa Massage", desc: "Stress relief therapeutic massage with warm aromatic oils", min: 60, fee: 2500, token: 50.00 },
      { name: "Balayage Highlights & Global Hair Color", desc: "Customized sun-kissed hair color with bond protector", min: 90, fee: 3500, token: 50.00 },
    ];

    for (const s of salonTemplates) {
      const ownerEmail = `${s.slug}-admin@test.com`;
      const staffEmail = `${s.slug}-stylist@test.com`;

      const owner = await prisma.user.upsert({
        where: { email: ownerEmail },
        update: {},
        create: {
          name: `${s.name} Admin`,
          email: ownerEmail,
          passwordHash,
          role: "ADMIN",
        },
      });

      const business = await prisma.business.upsert({
        where: { slug: s.slug },
        update: {
          name: s.name,
          description: `${s.specialty} • ${s.desc} • ${s.gender}`,
          address: s.area,
          latitude: s.lat,
          longitude: s.lng,
          categoryId: salonCat.id,
        },
        create: {
          name: s.name,
          slug: s.slug,
          ownerId: owner.id,
          categoryId: salonCat.id,
          description: `${s.specialty} • ${s.desc} • ${s.gender}`,
          address: s.area,
          latitude: s.lat,
          longitude: s.lng,
        },
      });

      await prisma.businessHours.deleteMany({ where: { businessId: business.id } });
      await prisma.businessHours.createMany({
        data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          businessId: business.id,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "21:00",
        })),
      });

      const stylistUser = await prisma.user.upsert({
        where: { email: staffEmail },
        update: { name: `${s.name} Senior Stylist` },
        create: {
          name: `${s.name} Senior Stylist`,
          email: staffEmail,
          passwordHash,
          role: "STAFF",
        },
      });

      const staff = await prisma.staffProfile.upsert({
        where: { userId: stylistUser.id },
        update: { title: "Senior Hair & Beauty Specialist" },
        create: {
          userId: stylistUser.id,
          businessId: business.id,
          title: "Senior Hair & Beauty Specialist",
        },
      });

      // Seed salon treatment services and time slots
      for (const t of salonServiceDefs) {
        let service = await prisma.service.findFirst({ where: { businessId: business.id, name: t.name } });
        if (!service) {
          service = await prisma.service.create({
            data: {
              businessId: business.id,
              name: t.name,
              description: `${t.desc} at ${s.name}`,
              durationMin: t.min,
              price: t.fee,
              tokenFee: t.token,
            },
          });
        }

        await prisma.slot.deleteMany({ where: { staffId: staff.id, serviceId: service.id, isBooked: false } });

        const slots = [];
        const today = new Date();
        const slotHours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

        for (let d = 0; d < 14; d++) {
          const day = new Date(today);
          day.setDate(day.getDate() + d);

          for (const h of slotHours) {
            const slotStart = new Date(day);
            slotStart.setHours(h, 0, 0, 0);
            const slotEnd = new Date(slotStart.getTime() + t.min * 60000);

            slots.push({
              staffId: staff.id,
              serviceId: service.id,
              startTime: slotStart,
              endTime: slotEnd,
            });
          }
        }

        await prisma.slot.createMany({ data: slots, skipDuplicates: true });
      }

      totalSalonsSeeded++;
    }
  }

  // 8. Ensure all seeded businesses have ACTIVE status and default BusinessSettings
  const allBusinesses = await prisma.business.findMany();
  for (const b of allBusinesses) {
    await prisma.business.update({
      where: { id: b.id },
      data: { status: "ACTIVE" },
    });
    await prisma.businessSettings.upsert({
      where: { businessId: b.id },
      update: {},
      create: {
        businessId: b.id,
        checkInBeforeMinutes: 30,
        gracePeriodMinutes: 15,
        autoNoShow: true,
      },
    });
  }

  console.log(`Successfully seeded ${totalClinicsSeeded} doctor clinics, ${totalGovtSeeded} government offices, ${totalRestaurantsSeeded} restaurants, and ${totalSalonsSeeded} salons!`);
  console.log(`All seeded businesses set to ACTIVE with default check-in settings.`);
  console.log(`Customer account: customer@test.com / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });