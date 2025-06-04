<?php
include_once('include/config.php');


?>
<!DOCTYPE html>
<html lang="en">
  <head>
        <?php include("head.php");?>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.11.5/css/dataTables.bootstrap4.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/5.3.0/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.datatables.net/2.0.3/css/dataTables.dataTables.css">
    <link rel="stylesheet" href="https://cdn.datatables.net/buttons/3.0.1/css/buttons.dataTables.css">
    <style>
         .modal-dialog {
    max-width: 60% !important; /* Increase the width to make it larger */
    margin: 1.75rem auto; /* Center the modal */
}

.modal-content {
    border-radius: 10px; /* Optional: rounded corners */
}
        /* Add your custom CSS styles here */
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
        }

        .container {
            margin: 0 auto;
            /* Center the container */
            max-width: 1000px;
            /* Adjust the max width as needed */
            position: relative;
            /* Position relative for absolute positioning of button */
        }

        .add-button-container {
            margin-bottom: 10px;
            position: absolute;
            top: 0;
            right: 0;
        }

        .table {
            background-color: #fff;
        }

        th,
        td {
            text-align: center;
        }

        .edit-employee,
        .delete-employee {
            text-decoration: none;
            cursor: pointer;
        }

        .edit-employee:hover,
        .delete-employee:hover {
            text-decoration: underline;
        }

        .modal-dialog {
            max-width: 500px;
        }

        .btn-group {
            display: flex;
            justify-content: center;
            gap: 10px;
            /* Add space between buttons */
        }

        /* Center the specific heading */
        .textalign-center {
            text-align: center !important; /* Add !important to override any conflicting CSS */
        }

       
    </style>
    </head>
  <body>
    <div x-data="setup()" x-init="$refs.loading.classList.add('hidden'); setColors(color);" :class="{ 'dark': isDark}">
      <div class="flex h-screen antialiased text-gray-900 bg-gray-100 dark:bg-dark dark:text-light">
        
        <?php include("sidebar.php");?>
        <div class="flex-1 h-full overflow-x-hidden overflow-y-auto">
            <?php include("header.php");?>

          <main>
            <div class="flex items-center justify-between px-4 py-4 border-b lg:py-6 dark:border-primary-darker">
              <h1 class="text-2xl font-semibold">batches List</h1>
           </div>
            <div class="mt-2">
              <div class="grid grid-cols-1 p-4 space-y-8 lg:gap-8 lg:space-y-0 lg:grid-cols-6">
                <div class="col-span-2 bg-white rounded-md dark:bg-darker" x-data="{ isOn: false }">
                  <div class="flex items-center justify-between p-4 border-b dark:border-primary">
                  
<div class="container">
        <div class="row justify-content-center">

            <div class="row justify-content-end">
                <div class="col-auto">
                    <a href="process_batch.php" class="btn btn-primary">Add New</a>
                </div>
            </div>


            <div class="col-lg-12">
                <table id="example" class="table table-striped" style="width:100%">
    <thead>
        <tr>
            <th scope="col" class="textalign-center">Sr.No</th>
            <th scope="col" class="textalign-center">District</th>
            
            <th scope="col" class="textalign-center">Batch Name</th>
            <th scope="col" class="textalign-center">Co-ordinator Name</th>
            <th scope="col" class="textalign-center">Training Type</th>
            <th scope="col" class="textalign-center">Training Group</th>
            
            <th scope="col" class="textalign-center">Action</th>
        </tr>
    </thead>

    <tbody>
        <?php
       $query = "
    SELECT 
        bt.batch_name, 
        bt.district, 
        b.coordinator_name, 
        b.service_type,
        b.district, 
        b.training_group
    FROM batch_teachers bt
    JOIN batches b ON bt.batch_name = b.batch_name
    WHERE bt.district = 'Nagpur' AND b.district = 'Nagpur'
    GROUP BY bt.batch_name
";



        $result = mysqli_query($conn, $query);
        $srNo = 1; // Counter for serial number
        if ($result) {
            while ($row = mysqli_fetch_assoc($result)) {
                $batch_name = $row["batch_name"];
                $district = $row["district"];
                $coordinator_name = $row["coordinator_name"];
                $service_type = $row["service_type"];
                $training_group = $row["training_group"];
                
                            
                echo "<tr>";
                echo "<td class=\"textalign-center\">" . $srNo++ . "</td>"; // Increment and display Sr.No
                echo "<td class=\"textalign-center\">" . $district . "</td>";
                echo "<td class=\"textalign-center\">" . $batch_name . "</td>";
                echo "<td class=\"textalign-center\">" . $coordinator_name . "</td>";
                echo "<td class=\"textalign-center\">" . $service_type . "</td>";
                echo "<td class=\"textalign-center\">" . $training_group . "</td>";
                

                echo "<td>";
                echo "<div class='btn-group' role='group'>";
               
               echo "<a href=\"#\" class=\"view-employee btn btn-success\" data-toggle=\"modal\" data-target=\"#employeeModal\" data-batch_name=\"$batch_name\">View</a>";
                echo "<a href=\"delete_batch.php?deleteid=$batch_name\" onClick=\"return confirm('Are you sure, you want to delete?')\" class=\"btn btn-danger\">Delete</a>";
                echo "<a href=\"send_email.php?batch_name=$batch_name\" class=\"btn btn-primary\">Email</a>";
                
                echo "</div>";
                echo "</td>";
                echo "</tr>";
            }
        }
        ?>
    </tbody>
</table>

            </div>
        </div>
    </div>


    <div class="modal fade" id="employeeModal" tabindex="-1" role="dialog" aria-labelledby="employeeModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="employeeModalLabel">Batches Details</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <!-- Employee details fetched by AJAX will be displayed here -->
                    <div id="employeeDetails"></div>
                </div>
<div class="modal-footer">
    
</div>

            </div>
        </div>
    </div>
                      
                      
                      
                      
                  </div>
                </div>
              </div>
            </div>
          </main>

        
          </div>
      </div>
    </div>
        <?php include("scr.php");?>
     <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.16.0/umd/popper.min.js"></script>

    <script>
       $(document).ready(function () {
    // When an Edit link is clicked


    // When a View link is clicked
    $(document).on("click", ".view-employee", function () {
        var batch_name = $(this).data("batch_name");
        $.ajax({
            type: "GET",
            url: "view_batch.php",
            data: { batch_name: batch_name },
            success: function (response) {
                $("#employeeDetails").html(response);
            }
        });
    });
  

    
});


            
           
    </script>

    

    <script src="https://code.jquery.com/jquery-3.5.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.5.4/dist/umd/popper.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js"></script>
    <script src="https://cdn.datatables.net/1.11.5/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.11.5/js/dataTables.bootstrap4.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.7.1.js"></script>
    <script src="https://cdn.datatables.net/2.0.3/js/dataTables.js"></script>
    <script src="https://cdn.datatables.net/buttons/3.0.1/js/dataTables.buttons.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js"></script>
    <script src="https://cdn.datatables.net/buttons/3.0.1/js/buttons.html5.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/3.0.1/js/buttons.print.min.js"></script>
        <script>
   $(document).ready(function() {
    $('#example').DataTable({
        dom: "<'row'<'col-md-12'B>>" +
     "<'row'<'col-md-6'l><'col-md-6 text-right'f>>" +
     "<'row'<'col-md-12'tr>>" +
     "<'row'<'col-md-5'i><'col-md-7 text-right'p>>",

        buttons: [
            {
                extend: 'excel',
                exportOptions: {
                    columns: ':not(:last-child)' // Exclude the last column
                }
            },
            {
                extend: 'pdf',
                exportOptions: {
                    columns: ':not(:last-child)' // Exclude the last column
                }
            },
            {
                extend: 'print',
                exportOptions: {
                    columns: ':not(:last-child)' // Exclude the last column
                }
            }
        ],
        lengthMenu: [10, 25, 50, 100]
    });
});

    </script>


  </body>
</html>
