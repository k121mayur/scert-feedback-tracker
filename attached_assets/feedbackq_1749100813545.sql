-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jun 05, 2025 at 10:49 AM
-- Server version: 8.0.41
-- PHP Version: 5.6.40

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `training_portal`
--

-- --------------------------------------------------------

--
-- Table structure for table `feedbackq`
--

CREATE TABLE `feedbackq` (
  `id` int NOT NULL,
  `feedback_ques` varchar(100) DEFAULT NULL,
  `option1` varchar(50) DEFAULT NULL,
  `option2` varchar(50) DEFAULT NULL,
  `option3` varchar(50) DEFAULT NULL,
  `option4` varchar(50) DEFAULT NULL,
  `option5` varchar(50) DEFAULT NULL,
  `created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Dumping data for table `feedbackq`
--

INSERT INTO `feedbackq` (`id`, `feedback_ques`, `option1`, `option2`, `option3`, `option4`, `option5`, `created`) VALUES
(1, 'सुलभकाचे स्पष्टीकरण कौशल्य', 'असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट', '2025-04-27 08:25:36'),
(2, ' सुलभकाने विषय समजावून सांगताना वापरलेली पद्धती तंत्रे ', 'असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट', '2025-04-27 08:25:36'),
(3, 'सुलभकाच्या सादरीकरणाची गती आणि सुसूत्रता ', 'असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट', '2025-04-27 08:26:06'),
(4, 'सुलभकाची शंकासमाधान पद्धती', 'असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट', '2025-04-27 08:26:06'),
(5, 'सुलभकाचे प्रशिक्षणा दरम्यान वर्तन', 'असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट', '2025-04-27 08:26:31'),
(6, 'सुलभकाचा प्रश्नोत्तर सत्रातील संयम आणि सकारात्मकता ', 'असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट', '2025-04-27 08:26:31'),
(7, 'सुलभकाचा प्रशिक्षणार्थी केंद्रित दृष्टिकोन', 'असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट', '2025-04-27 08:26:55'),
(8, 'सुलभकाने प्रशिक्षणा दरम्यान वेळेचे व्यवस्थापन', 'असमाधानकारक', 'बरा', 'समाधानकारक', 'चांगला', 'उत्कृष्ट', '2025-04-27 08:26:55');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `feedbackq`
--
ALTER TABLE `feedbackq`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `feedbackq`
--
ALTER TABLE `feedbackq`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
