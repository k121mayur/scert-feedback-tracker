<?php
include_once('include/config.php');
mysqli_set_charset($conn, "utf8");

if (isset($_GET['topic']) && isset($_GET['mobile'])) {
    $topic = mysqli_real_escape_string($conn, $_GET['topic']);
    $mobile = mysqli_real_escape_string($conn, $_GET['mobile']);
    
    // Query to check if the topic already exists for the mobile number
    $query = "SELECT COUNT(*) FROM tot_feedback WHERE topic_name = '$topic' AND mobile = '$mobile'";
    $result = mysqli_query($conn, $query);
    $row = mysqli_fetch_row($result);
    
    // Return response
    if ($row[0] > 0) {
        echo "exists"; // Topic exists for this mobile number
    } else {
        echo "not_exists"; // Topic does not exist for this mobile number
    }
}
?>
