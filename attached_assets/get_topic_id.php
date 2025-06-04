<?php
// get_topic_id.php
include('include/config.php');

if (isset($_GET['mobile'])) {
    $mobile = $_GET['mobile'];

    $query = "SELECT topic_id, batch_name, district FROM batch_teachers WHERE teacher_mobile = ? AND stop_time >= NOW()";
    $stmt = $conn->prepare($query);
    $stmt->bind_param("s", $mobile);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        echo json_encode([
            'success' => true,
            'topic_id' => $row['topic_id'],
            'batch_name' => $row['batch_name'],
            'district' => $row['district']
        ]);
    } else {
        echo json_encode(['success' => false]);
    }

    $stmt->close();
    $conn->close();
}
?>
