<?php
include_once('include/config.php');
mysqli_set_charset($conn, "utf8");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the posted data
    
      $topicName = mysqli_real_escape_string($conn, $_POST['topic_name']);
  
    $mobileNo = mysqli_real_escape_string($conn, $_POST['mobile_no']);
    $batch_name  = mysqli_real_escape_string($conn, $_POST['batch_name']);
    $district  = mysqli_real_escape_string($conn, $_POST['district']);
    $questions = json_decode($_POST['questions'], true); // Decoding the array of question texts
    $feedbackAnswers = json_decode($_POST['feedback_answers'], true); // Decoding the array of answers

    // Insert feedback for each question and answer
    $query = "INSERT INTO trainer_feedback (topic_id, mobile, feedback_que, feedback, batch_name,district ) VALUES ";

    foreach ($questions as $index => $question) {
        // Use the actual question text from the $questions array
        $feedbackQuestion = mysqli_real_escape_string($conn, $question);  // Using the question text from the POST data
        $feedbackAnswer = mysqli_real_escape_string($conn, $feedbackAnswers[$index]);

        $query .= "( '$topicName',  '$mobileNo', '$feedbackQuestion', '$feedbackAnswer', '$batch_name', '$district'),";
    }

    // Remove the trailing comma and execute the query
    $query = rtrim($query, ',');

    // Debugging: Print the query to the page (for testing purposes)
    // echo "<script>console.log('SQL Query: " . $query . "');</script>";

    if (mysqli_query($conn, $query)) {
        echo "success"; // Return success message to JavaScript
    } else {
        echo "Error: " . mysqli_error($conn); // Return error message to JavaScript
    }
}
?>
