<?php
include_once('include/config.php');
mysqli_set_charset($conn, "utf8");

$questions = [];

$query = mysqli_query($conn, "SELECT feedback_ques, option1, option2, option3, option4, option5 FROM feedbackq");

while ($row = mysqli_fetch_assoc($query)) {
    $questions[] = $row;
}

echo json_encode($questions);
?>
