/**
 * MASTER DATABASE SEEDER SCRIPT
 * Lokasi: daw-backend/scripts/seed.js
 * * Deskripsi:
 * Menggunakan standar ORM Sequelize (bukan Raw SQL) untuk memastikan
 * tabel dibuat sesuai dengan definisi Model yang benar, dan menghindari
 * duplikasi data saat script dijalankan berulang kali.
 */
require("dotenv").config({ path: "./.env" });
const bcrypt = require("bcryptjs"); // Pastikan import ini ada di paling atas file seed.js
const sequelize = require("../config/database");

// Import SEMUA Model yang mau di-seed
const User = require("../models/User");
const Settings = require("../models/Settings");
const AboutInfo = require("../models/AboutInfo");
const History = require("../models/History");
const BusinessSection = require("../models/BusinessSection");
const Affiliate = require("../models/Affiliate");
const BusinessMapMarker = require("../models/BusinessMapMarker");
const HeroSlides = require("../models/HeroSlides");
const HomeSettings = require("../models/HomeSettings");
const ImpactStats = require("../models/ImpactStats");
// const Inquiry = require("../models/Inquiry"); // Buka komen ini kalau mau test Inquiries
const InvestmentSettings = require("../models/InvestmentSettings");
const Management = require("../models/Management");
const Project = require("../models/Project");

// DEFAULT DATA (CONSTANTS)
const DEFAULT_SETTINGS = {
  companyName: "PT Dharma Agung Wijaya",
  address:
    "Alamanda Tower, 22nd Floor\nJl. TB Simatupang Kav 23-24 Cilandak Barat, Jakarta Selatan",
  phone: "+62 21 2966 1956",
  email: "info@daw.co.id",
  website: "www.daw.co.id",
  googleMapsUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.993077647209!2d106.7997972153702!3d-6.290886195446487!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f1fb25b84539%3A0xc6226d9c612f0b78!2sAlamanda%20Tower!5e0!3m2!1sen!2sid!4v1680000000000!5m2!1sen!2sid','https://www.linkedin.com/company/dharma-agung-wijaya','2026-03-25 09:07:25",
  linkedinUrl: "https://www.linkedin.com/company/dharma-agung-wijaya", // Saya tambahkan default LinkedIn biar rapi
};

const DEFAULT_PILLARS = [
  {
    id: "human",
    title: "Human Values",
    text: "To understand and apply humanitarian values...",
  },
  {
    id: "ethics",
    title: "Business Ethics",
    text: "Using the ethical norms prevailing...",
  },
  {
    id: "unity",
    title: "Unity Through Harmony",
    text: "To maintain harmony and unity...",
  },
  {
    id: "speed",
    title: "Speed and Leading Change",
    text: "To maintain and raise the speed...",
  },
  {
    id: "smart",
    title: "Working Smart in Learning Culture",
    text: "Diligent, persevering, serious...",
  },
];

const DEFAULT_HISTORIES = [
  {
    year: "2005",
    description:
      "DAW Group was founded in 2005 as an investment holding company in a food and beverage industry.",
  },
  {
    year: "2009",
    description:
      "In 2009, DAW Group was transformed as an operating holding company that focuses in resources and energy industry.",
  },
];

const DEFAULT_BUSINESSES = [
  {
    id: "energy",
    category: "Energy",
    title: "Energy Focus.",
    htmlContent: `<p><span style="color: oklch(0.208 0.042 265.755);">DAW&nbsp;Group&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">Energy&nbsp;Division</strong><span style="color: oklch(0.208 0.042 265.755);">&nbsp;focuses&nbsp;within&nbsp;the&nbsp;renewable&nbsp;energy&nbsp;sector.&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">In&nbsp;2014</strong><span style="color: oklch(0.208 0.042 265.755);">,&nbsp;we&nbsp;obtained&nbsp;one&nbsp;hydropower&nbsp;project&nbsp;in&nbsp;North&nbsp;Sumatera&nbsp;(Toba&nbsp;Samosir&nbsp;Region),&nbsp;with&nbsp;a&nbsp;capacity&nbsp;of&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">15&nbsp;Megawatts</strong><span style="color: oklch(0.208 0.042 265.755);">.&nbsp;We&nbsp;believe&nbsp;hydropower&nbsp;in&nbsp;Indonesia&nbsp;is&nbsp;really&nbsp;important&nbsp;in&nbsp;contributing&nbsp;to&nbsp;the&nbsp;country’s&nbsp;heavy&nbsp;need&nbsp;of&nbsp;power&nbsp;generation.</span></p><p><strong style="color: oklch(0.208 0.042 265.755);">In&nbsp;2011,</strong><span style="color: oklch(0.208 0.042 265.755);">&nbsp;we&nbsp;entered&nbsp;into&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">Operation&nbsp;and&nbsp;Maintenance&nbsp;services</strong><span style="color: oklch(0.208 0.042 265.755);">&nbsp;for&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">Indonesia&nbsp;state&nbsp;owned</strong><span style="color: oklch(0.208 0.042 265.755);">&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">electricity&nbsp;company&nbsp;(PLN)</strong><span style="color: oklch(0.208 0.042 265.755);">,&nbsp;focusing&nbsp;mainly&nbsp;in&nbsp;the&nbsp;coal&nbsp;fired&nbsp;power&nbsp;plants.&nbsp;Currently,&nbsp;we&nbsp;are&nbsp;serving&nbsp;five&nbsp;PLN&nbsp;power&nbsp;plants&nbsp;ranging&nbsp;from&nbsp;Sumatera,&nbsp;Kalimantan,&nbsp;and&nbsp;Sulawesi.</span></p><blockquote><span style="color: oklch(0.208 0.042 265.755);">We&nbsp;provide&nbsp;solutions&nbsp;to&nbsp;clients&nbsp;in&nbsp;various&nbsp;industries&nbsp;such&nbsp;as:&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">food&nbsp;and&nbsp;beverage</strong><span style="color: oklch(0.208 0.042 265.755);">,&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">textile</strong><span style="color: oklch(0.208 0.042 265.755);">,&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">chemical</strong><span style="color: oklch(0.208 0.042 265.755);">,&nbsp;and&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">steel</strong><span style="color: oklch(0.208 0.042 265.755);">,&nbsp;to&nbsp;get&nbsp;maximum&nbsp;energy&nbsp;efficiency.</span></blockquote>`,
    hasMap: true,
  },
  {
    id: "resources",
    category: "Resources",
    title: "Resource Focus.",
    htmlContent: `<p><span style="color: oklch(0.208 0.042 265.755);">DAW&nbsp;Group&nbsp;Resources&nbsp;division&nbsp;focuses&nbsp;is&nbsp;in&nbsp;the&nbsp;Palm&nbsp;Oil&nbsp;business.&nbsp;Our&nbsp;palm&nbsp;oil&nbsp;plantation&nbsp;is&nbsp;located&nbsp;in&nbsp;East&nbsp;Kalimantan&nbsp;with&nbsp;total&nbsp;plantable&nbsp;area&nbsp;of&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">10,000&nbsp;hectares</strong><span style="color: oklch(0.208 0.042 265.755);">.&nbsp;In&nbsp;the&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">downstream&nbsp;sector</strong><span style="color: oklch(0.208 0.042 265.755);">,&nbsp;DAW&nbsp;Group&nbsp;currently&nbsp;have&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">four&nbsp;CPO&nbsp;Mills</strong><span style="color: oklch(0.208 0.042 265.755);">&nbsp;in&nbsp;operation.&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">Two&nbsp;CPO&nbsp;Mills</strong><span style="color: oklch(0.208 0.042 265.755);">&nbsp;that&nbsp;are&nbsp;directly&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">owned&nbsp;by&nbsp;DAW</strong><span style="color: oklch(0.208 0.042 265.755);">&nbsp;are&nbsp;located&nbsp;in&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">East&nbsp;Kalimantan</strong><span style="color: oklch(0.208 0.042 265.755);">&nbsp;and&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">Jambi&nbsp;Province</strong><span style="color: oklch(0.208 0.042 265.755);">;&nbsp;and&nbsp;two&nbsp;other&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">CPO&nbsp;Mills&nbsp;in&nbsp;Lampung&nbsp;</strong><span style="color: oklch(0.208 0.042 265.755);">and&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">Jambi&nbsp;Province</strong><span style="color: oklch(0.208 0.042 265.755);">&nbsp;are&nbsp;owned&nbsp;through&nbsp;</span><strong style="color: oklch(0.208 0.042 265.755);">Tudung&nbsp;Group</strong><span style="color: oklch(0.208 0.042 265.755);">.</span></p><p><span style="color: oklch(0.208 0.042 265.755);">Below&nbsp;are&nbsp;the&nbsp;locations&nbsp;of&nbsp;our&nbsp;operating&nbsp;Palm&nbsp;Oil&nbsp;Plantations&nbsp;and&nbsp;Palm&nbsp;Oil&nbsp;Mills.</span></p>`,
    hasMap: true,
  },
];
// TRUE
const DEFAULT_AFFILIATES = [
  {
    name: "Suntory Garuda",
    desc: "",
    category: "fnb",
    logoUrl: "/uploads/management-1773282900972.png",
  },
  {
    name: "SNS",
    desc: "",
    category: "fnb",
    logoUrl: "/uploads/1773282900970-191407272.png",
  },
  {
    name: "Bank Maju",
    desc: "",
    category: "finance",
    logoUrl: "/uploads/1773282900974-199647141.png",
  },
  {
    name: "Global Sevilla",
    desc: "",
    category: "edu",
    logoUrl: "/uploads/1773282900978-466053072.png",
  },
  {
    name: "Garuda Food",
    desc: "",
    category: "fnb",
    logoUrl: "/uploads/1773282900968-374085108.png",
  },
  {
    name: "PT. BNM",
    desc: "",
    category: "steel",
    logoUrl: "/uploads/management-1773282900973.png",
  },
];

const DEFAULT_MAP_MARKERS = [
  {
    title: "Hydropower Kualu",
    desc: "15 MW",
    type: "direct",
    dotX: "6.65%",
    dotY: "25.78%",
    boxX: "6.65%",
    boxY: "13.91%",
    sectionId: "energy",
  },
  {
    title: "Jambi 1",
    desc: "45 ton/hour",
    type: "direct",
    dotX: "17.48%",
    dotY: "50.32%",
    boxX: "17.48%",
    boxY: "38.45%",
    sectionId: "resources",
  },
  {
    title: "Jambi 2",
    desc: "45-60 ton/hour",
    type: "tudung",
    dotX: "18.93%",
    dotY: "53.29%",
    boxX: "18.93%",
    boxY: "41.42%",
    sectionId: "resources",
  },
  {
    title: "Lampung",
    desc: "45 ton/hour",
    type: "tudung",
    dotX: "23.06%",
    dotY: "59.22%",
    boxX: "23.06%",
    boxY: "47.35%",
    sectionId: "resources",
  },
  {
    title: "Sangkulirang (Palm Oil Plantation)",
    desc: "10.000 ha landbank & 5073 ha planted",
    type: "direct",
    dotX: "49.84%",
    dotY: "35.28%",
    boxX: "49.84%",
    boxY: "23.41%",
    sectionId: "resources",
  },
  {
    title: "Sangkulirang (Palm Oil Mill)",
    desc: "30 ton/hour",
    type: "direct",
    dotX: "47.50%",
    dotY: "36.27%",
    boxX: "47.50%",
    boxY: "24.40%",
    sectionId: "resources",
  },
];

const DEFAULT_HERO_SLIDES = [
  {
    title: "A Transformation Company",
    subtitle:
      '"Success is born through honesty, persistence, and commitment in the light of constant prayer."',
    imageUrl: "/uploads/image-1773648091172-789410759.jpg",
    order: 0,
  },
  {
    title: "Continuous Improvement.",
    subtitle:
      "Advancing Indonesia's resources and renewable energy sectors through modern technology and ethical practices.",
    imageUrl: "/uploads/1773282061606-953181577.jpg",
    order: 1,
  },
  {
    title: "Interdependence Co-arising.",
    subtitle:
      "Integrating businesses from upstream to downstream to create sustainable value for society.",
    imageUrl: "/uploads/1773282061621-997705006.jpg",
    order: 2,
  },
];

const DEFAULT_HOME_SETTINGS = {
  introHeadline: "A Leading Operating Holding Company.",
  introBody:
    "PT Dharma Agung Wijaya (DAW Group) focuses on two core pillars: Renewable Energy and Resources. We are committed to operational excellence and living in harmony with Mother Nature, integrating our businesses from upstream to downstream to create sustainable value for society.",
};

const DEFAULT_IMPACT_STATS = [
  {
    icon: "Map",
    value: "10,000 +Ha",
    label: "Total Plantable Area",
    description: "in East Kalimantan region.",
    order: 0,
  },
  {
    icon: "Zap",
    value: "15 MW",
    label: "Hydropower Capacity",
    description: "potential at Project Kualu.",
    order: 1,
  },
  {
    icon: "Factory",
    value: "45 Tonnes/hr",
    label: "CPO Mill Capacity",
    description: "per mill in Bengkayang, Sanggau, and Jambi.",
    order: 2,
  },
  {
    icon: "Settings",
    value: "5 PLN Plants",
    label: "O&M Services",
    description: "across Sumatera, Kalimantan, and Sulawesi.",
    order: 3,
  },
];

// untuk testing
// const DEFAULT_INQUIRIES = [
//   { name: "Jap Feodrian Calvin", email: "jf.calvin20@gmail.com", phone: "089513598982", company: "Kadu", subject: "Careers", message: "Ingfo loker", status: 1 },
//   { name: "Budi Santoso", email: "budi.santoso@technusantara.co.id", phone: "62 812-3456-7890", company: "PT Teknologi Nusantara", subject: "Business Partnership", message: "Selamat siang tim DAW Group. Kami tertarik menjajaki peluang kerja sama...", status: 1 }
// ];

const DEFAULT_INVESTMENT_SETTINGS = {
  teaserHeadline: "Other Investments.",
  teaserBody:
    "Beyond our core operations in Resources and Renewable Energy, we strategically invest in emerging sectors to diversify our business ecosystem and drive long-term sustainable growth.",
  sectionIntro:
    "DAW also invests in other diversified businesses. Below is a summary of our other investments:",
};

const DEFAULT_MANAGEMENTS = [
  {
    name: "Sudhamek AWS",
    role: "Chairman",
    description: `Mr Sudhamek is the Chairman of PT. Dharma Agung Wijaya since 2009. He is also the Chairman of Garudafood Group since 2012. Previously, he had been the CEO of Garudafood group for 18 years.\n\nIn 2016, Mr. Sudhamek was inducted as a member of the National Economic & Industry Committe by The President of the Republic of Indonesia: Mr. Joko Widodo; within the same year, He was also awarded with Doctor Honoris Causa by The Universitas Kristen Satya Wacana, on his concept called the Spirituality Based Company (SBC). He is affiliated with other organisations, including as the Chairman of the oldest Buddhist organization in Indonesia (Buddhayana), one of the founders of ICRP (Indonesian Conference on Religion And Peace), and as the Board of Governors of an educational institution called Global Sevilla School, which he established together with the late Mr. Nurcholish Madjid.`,
    level: "chairman",
    order: 1,
    photoUrl: "/uploads/1773279893375-969525494.png",
  },
  {
    name: "Adhitya Soenjoto",
    role: "President Director",
    description:
      "He is the President Director of PT. Dharma Agung Wijaya since 2009, responsible for managing the whole business operation of DAW Group. He sits in the management board of other business units under DAW Group, such as: the Director of PT. Hanusentra Agro Lestari (a palm oil plantation) since 2012, the Director of PT Sentosa Bumi Wijaya (a palm oil mill) since 2010 and the Director of PT. Bina Niaga Multiusaha (precision stainless steel rolling mill) since 2016. From 2007 until 2008, he worked at Ernst & Young in Hong Kong, as an auditor. He obtained his Bachelor of Art Degree in Economics in 2005, at The University of Michigan - Ann Arbor, USA. He then obtained his MBA Degree in 2009, at Babson College, Boston - Massachusetts, USA.",
    level: "director",
    order: 1,
    photoUrl: null,
  },
  {
    name: "Yudie Soenjoto",
    role: "Vice President Director",
    description:
      "He is the Director of PT. Dharma Agung Wijaya since June 2014, with management responsibility over Energy Division of DAW group. Within the energy division, he serves as director at PT. BEA. He is affiliated with an educational institution a Board Member Executive Secreatry at Global Sevilla School. Prior to joining DAW group, he had served as Project Manager at Garudafood Group, from February 2010 until December 2011. He obtained his Bachelor Degree in Mechanical Engineering from University of Michigan - Ann Arbor. In 2014, he completed his M.B.A in entrepreneurship at Babson College, Wellesley, MA.",
    level: "director",
    order: 2,
    photoUrl: "/uploads/photo-1773725805880-128737937.jpg",
  },
  {
    name: "Hendy Liusgria",
    role: "Chief Financial Officer",
    description:
      "He is the Chief Financial Officer for PT. Dharma Agung Wijaya since 2019, with management responsibilities over the financials and tax of both Resources Division and Energy Division of DAW Group. Mr. Hendy had extensive and long term experiences in finance and tax, previously served as the CFO of PT Sinar Niaga Sejahtera, which is the distribution company serving Garudafood Group.",
    level: "division",
    order: 1,
    photoUrl: null,
  },
  {
    name: "Eduard Siregar",
    role: "Division Head",
    description:
      "Previously, he served the responsibility as Head of Financial Accounting under the Resources Division. In 2017, Mr Eduard served as the Head of Resources division of DAW, managing the operation of four palm oil mills and plantation in Sumatera and Kalimantan.",
    level: "division",
    order: 2,
    photoUrl: null,
  },
  {
    name: "Sentiyono",
    role: "Division Head",
    description:
      "He is the Head of Bioenergy Division of DAW Group since 2017, managing the operation of palm kernel shells trading business and renewable energy developments in the bioenergy sectors. He is also a certified Toyota Trainer in various subjects, such as Toyota Practical Problem Solving, Quality Control Check, and Project management.",
    level: "division",
    order: 3,
    photoUrl: null,
  },
];

const DEFAULT_PROJECTS = [
  {
    id: "4f4482dd-1df5-11f1-8a02-c03532f000ea",
    title: "CPO Mill and Plantation in West Kalimantan",
    excerpt: "Two CPO mills and 11,000 Ha in West Kalimantan.",
    content: `<p>In&nbsp;<strong>West&nbsp;Kalimantan</strong>,&nbsp;DAW&nbsp;Group&nbsp;owns&nbsp;two&nbsp;CPO&nbsp;mills&nbsp;in&nbsp;<strong>Bengkayang&nbsp;</strong>and&nbsp;<strong>Sanggau&nbsp;Region</strong>.&nbsp;Each&nbsp;CPO&nbsp;mill&nbsp;has&nbsp;a&nbsp;capacity&nbsp;of&nbsp;<strong>45&nbsp;tonnes&nbsp;per&nbsp;hour.</strong>&nbsp;</p><p>In&nbsp;<strong>the</strong>&nbsp;<strong>Bengkayang&nbsp;Region</strong>,&nbsp;DAW&nbsp;Group&nbsp;have&nbsp;a&nbsp;palm&nbsp;oil&nbsp;plantation&nbsp;land&nbsp;bank&nbsp;of<strong>&nbsp;11,000&nbsp;Ha.</strong></p><p></p><p>Please&nbsp;check&nbsp;our&nbsp;galleries&nbsp;below&nbsp;for&nbsp;a&nbsp;glimpse&nbsp;of&nbsp;our&nbsp;CPO&nbsp;Mill&nbsp;in&nbsp;West&nbsp;Kalimantan.</p><p></p>`,
    category: "Resources",
    status: "Published",
    author: "Jap Calvin",
    cover_image: "cover_image-1773307485898-998356838.jpg",
    gallery: [
      "gallery-1773307485905-887138229.jpg",
      "gallery-1773307485909-748912410.jpg",
      "gallery-1773307485919-506045683.jpg",
      "gallery-1773307485922-749410690.jpg",
      "gallery-1773307485922-562971435.jpeg",
    ],
    views: 24,
  },
  {
    id: "69f45ba3-1df5-11f1-8a02-c03532f000ea",
    title: "CPO Mill in Jambi",
    excerpt: "Newly acquired 45-tonne CPO mill in Sarolangun, Jambi.",
    content: `<p>Our&nbsp;newly&nbsp;acquired&nbsp;CPO&nbsp;mill&nbsp;is&nbsp;located&nbsp;in&nbsp;<strong>Sarolangun</strong>,&nbsp;Jambi.&nbsp;It&nbsp;is&nbsp;a&nbsp;<strong>45&nbsp;tonnes&nbsp;per&nbsp;hour&nbsp;capacity</strong>&nbsp;mill&nbsp;and&nbsp;already&nbsp;in&nbsp;operation&nbsp;since&nbsp;2015.</p><p>Please&nbsp;check&nbsp;our&nbsp;galleries&nbsp;below&nbsp;for&nbsp;a&nbsp;glimpse&nbsp;of&nbsp;our&nbsp;<strong>Palm&nbsp;oil&nbsp;Mill&nbsp;progress</strong>&nbsp;in&nbsp;<strong>Jambi&nbsp;-&nbsp;West&nbsp;Sumatera.</strong></p><p></p>`,
    category: "Resources",
    status: "Published",
    author: "Jap Calvin",
    cover_image: "cover_image-1773307530674-706401182.jpg",
    gallery: [
      "gallery-1773307530686-207993754.jpg",
      "gallery-1773307530689-925343087.jpg",
      "gallery-1773307530692-259329630.jpg",
      "gallery-1773307530693-549782054.jpg",
      "gallery-1773307530695-725032504.jpg",
    ],
    views: 1,
  },
  {
    id: "9990ab1f-1df5-11f1-8a02-c03532f000ea",
    title: "Hydropower - Kualu",
    excerpt: "15 MW hydropower project near Lake Toba, North Sumatera.",
    content: `<p><strong style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">Project&nbsp;Kualu</strong><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">&nbsp;is&nbsp;a&nbsp;hydropower&nbsp;(PLTA)&nbsp;project,&nbsp;which&nbsp;has&nbsp;a&nbsp;power&nbsp;potential&nbsp;of&nbsp;</span><strong style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">15&nbsp;MW</strong><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">.&nbsp;It&nbsp;is&nbsp;located&nbsp;at&nbsp;</span><strong style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">North&nbsp;Sumatera</strong><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">&nbsp;near&nbsp;</span><strong style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">the&nbsp;Toba&nbsp;Lake</strong><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">.&nbsp;The&nbsp;name&nbsp;of&nbsp;the&nbsp;river&nbsp;is&nbsp;</span><strong style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">Kualu</strong><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">;&nbsp;the&nbsp;river&nbsp;runs&nbsp;long&nbsp;and&nbsp;is&nbsp;</span><strong style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">connected</strong><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">&nbsp;to&nbsp;</span><strong style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">the&nbsp;channels</strong><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">&nbsp;of&nbsp;the&nbsp;Toba&nbsp;Lake.&nbsp;Currently,&nbsp;the&nbsp;project&nbsp;is&nbsp;undergoing&nbsp;a&nbsp;Feasibility&nbsp;Study,&nbsp;which&nbsp;assess&nbsp;Topography&nbsp;study,&nbsp;geology&nbsp;study,&nbsp;and&nbsp;Basic&nbsp;Design&nbsp;of&nbsp;the&nbsp;hydropower&nbsp;plant.</span></p><p><img src="http://localhost:5000/uploads/inline_image-1773307601439-267751031.jpg"></p>`,
    category: "Energy",
    status: "Published",
    author: "Jap Calvin",
    cover_image: "cover_image-1773307610567-486901940.jpg",
    gallery: ["gallery-1773307610570-764330027.jpg"],
    views: 5,
  },
  {
    id: "ac7c22e2-1df5-11f1-8a02-c03532f000ea",
    title: "Stockpile - Jambi",
    excerpt: "High-quality PKS stockpile and fuel products in Jambi.",
    content: `<p><strong style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">Palm&nbsp;kernel&nbsp;shells&nbsp;</strong><span style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">(or&nbsp;PKS)&nbsp;a&nbsp;factory&nbsp;that&nbsp;processes&nbsp;oil&nbsp;palm&nbsp;</span><strong style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">Fresh&nbsp;Fruit&nbsp;Bunches&nbsp;</strong><span style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">(FFB)&nbsp;into&nbsp;crude&nbsp;palm&nbsp;oil&nbsp;(Crude&nbsp;Palm&nbsp;Oil&nbsp;/&nbsp;CPO)&nbsp;and&nbsp;Palm&nbsp;kernel&nbsp;(Kernel)&nbsp;products.&nbsp;As&nbsp;well&nbsp;as&nbsp;other&nbsp;products&nbsp;such&nbsp;as&nbsp;fiber&nbsp;and&nbsp;shells&nbsp;that&nbsp;can&nbsp;be&nbsp;used&nbsp;as&nbsp;fuel.&nbsp;The&nbsp;palm&nbsp;oil&nbsp;mill&nbsp;(POM)&nbsp;is&nbsp;built&nbsp;based&nbsp;on&nbsp;a&nbsp;certain&nbsp;design&nbsp;according&nbsp;to&nbsp;their&nbsp;wants&nbsp;or&nbsp;needs,&nbsp;accompanied&nbsp;by&nbsp;different&nbsp;technologies&nbsp;and&nbsp;different&nbsp;</span><strong style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">capacities</strong><span style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">.</span></p><p></p><p><strong style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">Our&nbsp;Quality&nbsp;PKS</strong></p><ul><li><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">Calorific&nbsp;value&nbsp;(4k&nbsp;based&nbsp;on&nbsp;ARB)</span></li><li><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">Total&nbsp;Moisture&nbsp;15%&nbsp;-&nbsp;20%&nbsp;(depend&nbsp;customer)</span></li><li><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">Foreight&nbsp;Matter&nbsp;Max&nbsp;(0,1)</span></li><li><span style="background-color: rgb(255, 255, 255); color: rgb(51, 51, 51);">Ash&nbsp;Content&nbsp;(Max&nbsp;3,5&nbsp;%&nbsp;based&nbsp;on&nbsp;ADB)</span></li></ul><p><img src="http://localhost:5000/uploads/inlineimage-1773724119917-702878819.jpg"></p><p></p>`,
    category: "Energy",
    status: "Published",
    author: "Jap Calvin",
    cover_image: "cover_image-1773307642310-730089667.jpeg",
    gallery: ["gallery-1773307642312-402445926.jpeg"],
    views: 43,
  },
  {
    id: "f8f4ad92-1df3-11f1-8a02-c03532f000ea",
    title: "Palm Oil Plantation in East Kalimantan",
    excerpt: "10,000 Ha palm oil plantation in East Kalimantan.",
    content: `<p><span style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">Our&nbsp;first&nbsp;palm&nbsp;oil&nbsp;plantation&nbsp;is&nbsp;located&nbsp;in&nbsp;</span><strong style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">Kutai&nbsp;Timur&nbsp;Region&nbsp;-&nbsp;East&nbsp;Kalimantan</strong><span style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">,&nbsp;with&nbsp;total&nbsp;planted&nbsp;area&nbsp;of&nbsp;</span><strong style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">5,100&nbsp;Ha</strong><span style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">.&nbsp;The&nbsp;CPO&nbsp;mill,&nbsp;with&nbsp;</span><strong style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">45&nbsp;tonnes&nbsp;per&nbsp;hour&nbsp;capacity</strong><span style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">,&nbsp;will&nbsp;commence&nbsp;in&nbsp;mid&nbsp;of&nbsp;2018.&nbsp;Another&nbsp;estate&nbsp;(land&nbsp;bank)&nbsp;is&nbsp;located&nbsp;30&nbsp;Km&nbsp;north&nbsp;of&nbsp;HAL&nbsp;plantation,&nbsp;with&nbsp;total&nbsp;plantable&nbsp;area&nbsp;of&nbsp;</span><strong style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">5,000&nbsp;Ha.</strong><span style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">&nbsp;Hence,&nbsp;the&nbsp;total&nbsp;plantable&nbsp;area&nbsp;in&nbsp;</span><strong style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">East&nbsp;Kalimantan</strong><span style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">&nbsp;will&nbsp;be&nbsp;</span><strong style="color: rgb(51, 51, 51); background-color: rgb(255, 255, 255);">10,000&nbsp;Ha.&nbsp;</strong></p>`,
    category: "Resources",
    status: "Published",
    author: "Jap Calvin",
    cover_image: "1773306911586-975036686.jpg",
    gallery: [
      "gallery-1773307381099-381950749.jpg",
      "gallery-1773307381125-605669711.jpg",
      "gallery-1773307381137-320017060.jpg",
      "gallery-1773307381138-174096096.jpg",
      "gallery-1773307381140-622291193.jpg",
      "gallery-1773307381143-115357957.jpg",
      "gallery-1773307381145-771915469.jpg",
    ],
    views: 41,
  },
];

const DEFAULT_USERS = [
  {
    id: "195fc498-ac3a-4bfa-a3a2-30b2613cb680",
    name: "Joko Sudibah",
    email: "jap.calv@gmail.com",
    password: "AdminDaw123!",
    role: "Editor",
    status: "Active",
  },
  {
    id: "51ba09b4-edc5-4ccd-8aae-802647f0ba1d",
    name: "Jap Calvin",
    email: "jf.calvin20@gmail.com",
    password: "AdminDaw123!",
    role: "superadmin",
    status: "Active",
  },
  {
    id: "b9e90a55-9b6f-4386-b022-3ab92bf49180",
    name: "Rama Ilyasyah",
    email: "rama.ilyasyah@daw.co.id",
    password: "Daw9795!",
    role: "superadmin",
    status: "Active",
  },
  {
    id: "ca2f5579-6f9c-4eda-b9a1-48e029db6f53",
    name: "John Doe",
    email: "john@daw.co.id",
    password: "AdminDaw123!",
    role: "Editor",
    status: "Active",
  },
];

async function runMasterSeeder() {
  console.log("DEBUG: Mencoba konek ke port:", process.env.DB_PORT); // Tambahin ini!
  try {
    console.log(" Memulai Master Seeder DAW Group...");

    // 1. SINKRONISASI MODEL
    await sequelize.sync();
    await sequelize.sync({ force: true });
    console.log("✅ Struktur tabel terverifikasi oleh Sequelize.");

    // 2. SEED USERS
    for (const u of DEFAULT_USERS) {
      const [user, created] = await User.findOrCreate({
        where: { email: u.email },
        defaults: u,
      });

      if (!created) {
        // Jika user sudah ada, kita timpa passwordnya dengan plaintext.
        // Hook 'beforeUpdate' di User.js akan otomatis melakukan hashing yang BENAR.
        user.password = u.password;
        await user.save();
        console.log(
          `Password untuk '${u.name}' telah diperbarui (Clean Hash).`,
        );
      } else {
        console.log(`✅ Akun ${u.role} '${u.name}' berhasil dibuat!`);
      }
    }

    // 3. SEED SETTINGS
    const [settings, settingsCreated] = await Settings.findOrCreate({
      where: { id: 1 },
      defaults: DEFAULT_SETTINGS,
    });
    if (settingsCreated) console.log("✅ Default Settings ditambahkan.");

    // 4. SEED ABOUT INFO
    const [about, aboutCreated] = await AboutInfo.findOrCreate({
      where: { id: 1 },
      defaults: {
        spiritText: "Success is born through honesty...",
        missionText: "We are a transformation-making company...",
        visionText: "To become one of the most respected...",
        philosophyTitle: "Our Philosophy",
        philosophyPillars: DEFAULT_PILLARS,
      },
    });
    if (aboutCreated) console.log("✅ Default About Info ditambahkan.");

    // 5. SEED HISTORIES
    const historyCount = await History.count();
    if (historyCount === 0) {
      await History.bulkCreate(DEFAULT_HISTORIES);
      console.log("✅ Default Histories (Timeline) ditambahkan.");
    }

    // 6. SEED BUSINESS SECTIONS
    for (const item of DEFAULT_BUSINESSES) {
      const [biz, bizCreated] = await BusinessSection.findOrCreate({
        where: { id: item.id },
        defaults: item,
      });
      if (bizCreated)
        console.log(`✅ Business Section '${item.category}' ditambahkan.`);
    }

    // 7. SEED AFFILIATES
    const affiliateCount = await Affiliate.count();
    if (affiliateCount === 0) {
      await Affiliate.bulkCreate(DEFAULT_AFFILIATES);
      console.log("✅ Data Affiliates / Partners berhasil disuntikkan.");
    }

    // 8. SEED MAP MARKERS
    const markerCount = await BusinessMapMarker.count();
    if (markerCount === 0) {
      await BusinessMapMarker.bulkCreate(DEFAULT_MAP_MARKERS);
      console.log("✅ Data Map Markers berhasil disuntikkan.");
    }

    // 9. SEED HERO SLIDES
    const slideCount = await HeroSlides.count();
    if (slideCount === 0) {
      await HeroSlides.bulkCreate(DEFAULT_HERO_SLIDES);
      console.log("✅ Data Hero Slides berhasil disuntikkan.");
    }

    // 10. SEED HOME SETTINGS
    const [homeSet, homeSetCreated] = await HomeSettings.findOrCreate({
      where: { introHeadline: DEFAULT_HOME_SETTINGS.introHeadline },
      defaults: DEFAULT_HOME_SETTINGS,
    });
    if (homeSetCreated) console.log("✅ Default Home Settings ditambahkan.");

    // 11. SEED IMPACT STATS
    const statCount = await ImpactStats.count();
    if (statCount === 0) {
      await ImpactStats.bulkCreate(DEFAULT_IMPACT_STATS);
      console.log("✅ Data Impact Stats berhasil disuntikkan.");
    }

    // 12. SEED INVESTMENT SETTINGS
    const [invSet, invSetCreated] = await InvestmentSettings.findOrCreate({
      where: { teaserHeadline: DEFAULT_INVESTMENT_SETTINGS.teaserHeadline }, // Pakai kolom yang ada di model
      defaults: DEFAULT_INVESTMENT_SETTINGS,
    });
    if (invSetCreated)
      console.log("✅ Default Investment Settings ditambahkan.");

    // 13. SEED MANAGEMENTS
    const mgtCount = await Management.count();
    if (mgtCount === 0) {
      await Management.bulkCreate(DEFAULT_MANAGEMENTS);
      console.log("✅ Data Management (Direksi) berhasil disuntikkan.");
    }

    // 14. SEED PROJECTS
    const projectCount = await Project.count();
    if (projectCount === 0) {
      await Project.bulkCreate(DEFAULT_PROJECTS);
      console.log("✅ Data Projects (Berita/Artikel) berhasil disuntikkan.");
    }

    console.log("\n🎉 BOOM! Master Seeding Selesai dengan Sempurna!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Gagal melakukan seeding:", error);
    process.exit(1);
  }
}

// Jalankan Seeder
runMasterSeeder();
