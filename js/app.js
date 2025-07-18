// Company Directory Application Logic

// Global variables
let allPersonnel = [];
let allDepartments = [];
let allLocations = [];
let currentFilter = { department: '', location: '' };

// Base URL for PHP files - update this to match your server structure
const baseURL = 'php/';

// Initialize app when document is ready
$(document).ready(function() {
    refreshPersonnelTable();
    refreshDepartmentTable();
    refreshLocationTable();
});

// ============================
// SEARCH FUNCTIONALITY
// ============================

$("#searchInp").on("keyup", function () {
    const searchTerm = $(this).val().toLowerCase();
    if ($("#personnelBtn").hasClass("active")) {
        filterPersonnelTable(searchTerm);
    } else if ($("#departmentsBtn").hasClass("active")) {
        filterDepartmentTable(searchTerm);
    } else {
        filterLocationTable(searchTerm);
    }
});

// ============================
// MAIN BUTTON HANDLERS
// ============================

$("#refreshBtn").click(function () {
    if ($("#personnelBtn").hasClass("active")) {
        refreshPersonnelTable();
    } else if ($("#departmentsBtn").hasClass("active")) {
        refreshDepartmentTable();
    } else {
        refreshLocationTable();
    }
});

$("#filterBtn").click(function () {
    if ($("#personnelBtn").hasClass("active")) {
        loadFilterOptions();
        $("#filterModal").modal('show');
    }
});

$("#addBtn").click(function () {
    if ($("#personnelBtn").hasClass("active")) {
        loadDepartmentsForModal('add');
        $("#addPersonnelModal").modal('show');
    } else if ($("#departmentsBtn").hasClass("active")) {
        loadLocationsForModal('add');
        $("#addDepartmentModal").modal('show');
    } else {
        $("#addLocationModal").modal('show');
    }
});

// ============================
// TAB HANDLERS
// ============================

$("#personnelBtn").click(function () {
    refreshPersonnelTable();
});

$("#departmentsBtn").click(function () {
    refreshDepartmentTable();
});

$("#locationsBtn").click(function () {
    refreshLocationTable();
});

// ============================
// PERSONNEL FUNCTIONS
// ============================

function refreshPersonnelTable() {
    $.ajax({
        url: baseURL + "getAll.php",
        type: "GET",
        dataType: "json",
        success: function (result) {
            if (result.status.code == 200) {
                allPersonnel = result.data;
                displayPersonnelTable(allPersonnel);
            } else {
                console.error("Error loading personnel:", result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.error("AJAX error loading personnel:", textStatus, errorThrown);
        }
    });
}

function displayPersonnelTable(personnel) {
    let tableHTML = '';
    personnel.forEach(function(person) {
        tableHTML += `
            <tr>
                <td class="align-middle text-nowrap">
                    ${person.lastName}, ${person.firstName}
                </td>
                <td class="align-middle text-nowrap d-none d-md-table-cell">
                    ${person.department || ''}
                </td>
                <td class="align-middle text-nowrap d-none d-md-table-cell">
                    ${person.location || ''}
                </td>
                <td class="align-middle text-nowrap d-none d-md-table-cell">
                    ${person.email}
                </td>
                <td class="text-end text-nowrap">
                    <button type="button" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#editPersonnelModal" data-id="${person.id}">
                        <i class="fa-solid fa-pencil fa-fw"></i>
                    </button>
                    <button type="button" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#deletePersonnelModal" data-id="${person.id}">
                        <i class="fa-solid fa-trash fa-fw"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    $("#personnelTableBody").html(tableHTML);
}

function filterPersonnelTable(searchTerm) {
    let filtered = allPersonnel.filter(person => {
        const matchesSearch = !searchTerm || 
            person.firstName.toLowerCase().includes(searchTerm) ||
            person.lastName.toLowerCase().includes(searchTerm) ||
            person.email.toLowerCase().includes(searchTerm) ||
            (person.jobTitle && person.jobTitle.toLowerCase().includes(searchTerm)) ||
            (person.department && person.department.toLowerCase().includes(searchTerm)) ||
            (person.location && person.location.toLowerCase().includes(searchTerm));
        
        const matchesDept = !currentFilter.department || person.departmentID == currentFilter.department;
        const matchesLoc = !currentFilter.location || person.departmentID == currentFilter.location;
        
        return matchesSearch && matchesDept && matchesLoc;
    });
    displayPersonnelTable(filtered);
}

// ============================
// DEPARTMENT FUNCTIONS
// ============================

function refreshDepartmentTable() {
    $.ajax({
        url: baseURL + "getAllDepartments.php",
        type: "GET",
        dataType: "json",
        success: function (result) {
            if (result.status.code == 200) {
                allDepartments = result.data;
                // Get location names for each department
                $.ajax({
                    url: baseURL + "getAllLocations.php",
                    type: "GET",
                    dataType: "json",
                    success: function (locationResult) {
                        if (locationResult.status.code == 200) {
                            const locations = locationResult.data;
                            allDepartments.forEach(dept => {
                                const location = locations.find(loc => loc.id == dept.locationID);
                                dept.locationName = location ? location.name : '';
                            });
                            displayDepartmentTable(allDepartments);
                        }
                    }
                });
            }
        }
    });
}

function displayDepartmentTable(departments) {
    let tableHTML = '';
    departments.forEach(function(dept) {
        tableHTML += `
            <tr>
                <td class="align-middle text-nowrap">
                    ${dept.name}
                </td>
                <td class="align-middle text-nowrap d-none d-md-table-cell">
                    ${dept.locationName || ''}
                </td>
                <td class="align-middle text-end text-nowrap">
                    <button type="button" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#editDepartmentModal" data-id="${dept.id}">
                        <i class="fa-solid fa-pencil fa-fw"></i>
                    </button>
                    <button type="button" class="btn btn-primary btn-sm deleteDepartmentBtn" data-id="${dept.id}">
                        <i class="fa-solid fa-trash fa-fw"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    $("#departmentTableBody").html(tableHTML);
}

function filterDepartmentTable(searchTerm) {
    let filtered = allDepartments.filter(dept => 
        dept.name.toLowerCase().includes(searchTerm) ||
        (dept.locationName && dept.locationName.toLowerCase().includes(searchTerm))
    );
    displayDepartmentTable(filtered);
}

// ============================
// LOCATION FUNCTIONS
// ============================

function refreshLocationTable() {
    $.ajax({
        url: baseURL + "getAllLocations.php",
        type: "GET",
        dataType: "json",
        success: function (result) {
            if (result.status.code == 200) {
                allLocations = result.data;
                displayLocationTable(allLocations);
            }
        }
    });
}

function displayLocationTable(locations) {
    let tableHTML = '';
    locations.forEach(function(location) {
        tableHTML += `
            <tr>
                <td class="align-middle text-nowrap">
                    ${location.name}
                </td>
                <td class="align-middle text-end text-nowrap">
                    <button type="button" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#editLocationModal" data-id="${location.id}">
                        <i class="fa-solid fa-pencil fa-fw"></i>
                    </button>
                    <button type="button" class="btn btn-primary btn-sm deleteLocationBtn" data-id="${location.id}">
                        <i class="fa-solid fa-trash fa-fw"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    $("#locationTableBody").html(tableHTML);
}

function filterLocationTable(searchTerm) {
    let filtered = allLocations.filter(location => 
        location.name.toLowerCase().includes(searchTerm)
    );
    displayLocationTable(filtered);
}

// ============================
// MODAL EVENT HANDLERS
// ============================

// Personnel modals
$("#editPersonnelModal").on("show.bs.modal", function (e) {
    const id = $(e.relatedTarget).attr("data-id");
    $.ajax({
        url: baseURL + "getPersonnelByID.php",
        type: "POST",
        dataType: "json",
        data: { id: id },
        success: function (result) {
            if (result.status.code == 200) {
                $("#editPersonnelEmployeeID").val(result.data.personnel[0].id);
                $("#editPersonnelFirstName").val(result.data.personnel[0].firstName);
                $("#editPersonnelLastName").val(result.data.personnel[0].lastName);
                $("#editPersonnelJobTitle").val(result.data.personnel[0].jobTitle);
                $("#editPersonnelEmailAddress").val(result.data.personnel[0].email);
                
                $("#editPersonnelDepartment").html("");
                $.each(result.data.department, function () {
                    $("#editPersonnelDepartment").append(
                        $("<option>", {
                            value: this.id,
                            text: this.name
                        })
                    );
                });
                $("#editPersonnelDepartment").val(result.data.personnel[0].departmentID);
            } else {
                $("#editPersonnelModal .modal-title").text("Error retrieving data");
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            $("#editPersonnelModal .modal-title").text("Error retrieving data");
        }
    });
});

$("#addPersonnelModal").on("show.bs.modal", function (e) {
    loadDepartmentsForModal('add');
    // Clear form
    $("#addPersonnelForm")[0].reset();
});

$("#deletePersonnelModal").on("show.bs.modal", function (e) {
    const id = $(e.relatedTarget).attr("data-id");
    $("#deletePersonnelID").val(id);
});

// Department modals
$("#editDepartmentModal").on("show.bs.modal", function (e) {
    const id = $(e.relatedTarget).attr("data-id");
    $.ajax({
        url: baseURL + "getDepartmentByID.php",
        type: "POST",
        dataType: "json",
        data: { id: id },
        success: function (result) {
            if (result.status.code == 200) {
                $("#editDepartmentID").val(result.data[0].id);
                $("#editDepartmentName").val(result.data[0].name);
                loadLocationsForSelect("#editDepartmentLocation", result.data[0].locationID);
            }
        }
    });
});

$("#addDepartmentModal").on("show.bs.modal", function (e) {
    loadLocationsForSelect("#addDepartmentLocation");
    $("#addDepartmentForm")[0].reset();
});

// Location modals
$("#editLocationModal").on("show.bs.modal", function (e) {
    const id = $(e.relatedTarget).attr("data-id");
    $.ajax({
        url: baseURL + "getLocationByID.php",
        type: "POST",
        dataType: "json",
        data: { id: id },
        success: function (result) {
            if (result.status.code == 200) {
                $("#editLocationID").val(result.data[0].id);
                $("#editLocationName").val(result.data[0].name);
            }
        }
    });
});

$("#addLocationModal").on("show.bs.modal", function (e) {
    $("#addLocationForm")[0].reset();
});

// ============================
// HELPER FUNCTIONS
// ============================

function loadDepartmentsForModal(action) {
    $.ajax({
        url: baseURL + "getAllDepartments.php",
        type: "GET",
        dataType: "json",
        success: function (result) {
            if (result.status.code == 200) {
                const selectId = action === 'add' ? "#addPersonnelDepartment" : "#editPersonnelDepartment";
                $(selectId).html("");
                $.each(result.data, function () {
                    $(selectId).append(
                        $("<option>", {
                            value: this.id,
                            text: this.name
                        })
                    );
                });
            }
        }
    });
}

function loadLocationsForSelect(selectId, selectedValue = null) {
    $.ajax({
        url: baseURL + "getAllLocations.php",
        type: "GET",
        dataType: "json",
        success: function (result) {
            if (result.status.code == 200) {
                $(selectId).html("");
                $.each(result.data, function () {
                    $(selectId).append(
                        $("<option>", {
                            value: this.id,
                            text: this.name
                        })
                    );
                });
                if (selectedValue) {
                    $(selectId).val(selectedValue);
                }
            }
        }
    });
}

function loadFilterOptions() {
    // Load departments
    $.ajax({
        url: baseURL + "getAllDepartments.php",
        type: "GET",
        dataType: "json",
        success: function (result) {
            if (result.status.code == 200) {
                $("#filterDepartment").html('<option value="">All Departments</option>');
                $.each(result.data, function () {
                    $("#filterDepartment").append(
                        $("<option>", {
                            value: this.id,
                            text: this.name
                        })
                    );
                });
            }
        }
    });
    
    // Load locations
    $.ajax({
        url: baseURL + "getAllLocations.php",
        type: "GET",
        dataType: "json",
        success: function (result) {
            if (result.status.code == 200) {
                $("#filterLocation").html('<option value="">All Locations</option>');
                $.each(result.data, function () {
                    $("#filterLocation").append(
                        $("<option>", {
                            value: this.id,
                            text: this.name
                        })
                    );
                });
            }
        }
    });
}

// ============================
// FORM SUBMISSIONS
// ============================

// Personnel forms
$("#editPersonnelForm").on("submit", function (e) {
    e.preventDefault();
    $.ajax({
        url: baseURL + "updatePersonnel.php",
        type: "POST",
        dataType: "json",
        data: {
            id: $("#editPersonnelEmployeeID").val(),
            firstName: $("#editPersonnelFirstName").val(),
            lastName: $("#editPersonnelLastName").val(),
            jobTitle: $("#editPersonnelJobTitle").val(),
            email: $("#editPersonnelEmailAddress").val(),
            departmentID: $("#editPersonnelDepartment").val()
        },
        success: function (result) {
            if (result.status.code == 200) {
                $("#editPersonnelModal").modal('hide');
                refreshPersonnelTable();
            } else {
                alert("Error updating personnel: " + result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error updating personnel: " + textStatus);
        }
    });
});

$("#addPersonnelForm").on("submit", function (e) {
    e.preventDefault();
    $.ajax({
        url: baseURL + "insertPersonnel.php",
        type: "POST",
        dataType: "json",
        data: {
            firstName: $("#addPersonnelFirstName").val(),
            lastName: $("#addPersonnelLastName").val(),
            jobTitle: $("#addPersonnelJobTitle").val(),
            email: $("#addPersonnelEmailAddress").val(),
            departmentID: $("#addPersonnelDepartment").val()
        },
        success: function (result) {
            if (result.status.code == 200) {
                $("#addPersonnelModal").modal('hide');
                refreshPersonnelTable();
            } else {
                alert("Error adding personnel: " + result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error adding personnel: " + textStatus);
        }
    });
});

$("#confirmDeletePersonnel").click(function() {
    $.ajax({
        url: baseURL + "deletePersonnelByID.php",
        type: "POST",
        dataType: "json",
        data: { id: $("#deletePersonnelID").val() },
        success: function (result) {
            if (result.status.code == 200) {
                $("#deletePersonnelModal").modal('hide');
                refreshPersonnelTable();
            } else {
                alert("Error deleting personnel: " + result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error deleting personnel: " + textStatus);
        }
    });
});

// Department forms
$("#editDepartmentForm").on("submit", function (e) {
    e.preventDefault();
    $.ajax({
        url: baseURL + "updateDepartment.php",
        type: "POST",
        dataType: "json",
        data: {
            id: $("#editDepartmentID").val(),
            name: $("#editDepartmentName").val(),
            locationID: $("#editDepartmentLocation").val()
        },
        success: function (result) {
            if (result.status.code == 200) {
                $("#editDepartmentModal").modal('hide');
                refreshDepartmentTable();
            } else {
                alert("Error updating department: " + result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error updating department: " + textStatus);
        }
    });
});

$("#addDepartmentForm").on("submit", function (e) {
    e.preventDefault();
    $.ajax({
        url: baseURL + "insertDepartment.php",
        type: "POST",
        dataType: "json",
        data: {
            name: $("#addDepartmentName").val(),
            locationID: $("#addDepartmentLocation").val()
        },
        success: function (result) {
            if (result.status.code == 200) {
                $("#addDepartmentModal").modal('hide');
                refreshDepartmentTable();
            } else {
                alert("Error adding department: " + result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error adding department: " + textStatus);
        }
    });
});

// Department delete with dependency check
$(document).on('click', '.deleteDepartmentBtn', function() {
    const deptId = $(this).attr('data-id');
    $.ajax({
        url: baseURL + "checkDepartmentDependencies.php",
        type: "POST",
        dataType: "json",
        data: { id: deptId },
        success: function (result) {
            if (result.status.code == 200) {
                if (result.data.personnelCount > 0) {
                    alert("Cannot delete department - personnel exist in this department");
                } else {
                    $("#deleteDepartmentID").val(deptId);
                    $("#deleteDepartmentModal").modal('show');
                }
            }
        }
    });
});

$("#confirmDeleteDepartment").click(function() {
    $.ajax({
        url: baseURL + "deleteDepartmentByID.php",
        type: "POST",
        dataType: "json",
        data: { id: $("#deleteDepartmentID").val() },
        success: function (result) {
            if (result.status.code == 200) {
                $("#deleteDepartmentModal").modal('hide');
                refreshDepartmentTable();
            } else {
                alert("Error deleting department: " + result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error deleting department: " + textStatus);
        }
    });
});

// Location forms
$("#editLocationForm").on("submit", function (e) {
    e.preventDefault();
    $.ajax({
        url: baseURL + "updateLocation.php",
        type: "POST",
        dataType: "json",
        data: {
            id: $("#editLocationID").val(),
            name: $("#editLocationName").val()
        },
        success: function (result) {
            if (result.status.code == 200) {
                $("#editLocationModal").modal('hide');
                refreshLocationTable();
            } else {
                alert("Error updating location: " + result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error updating location: " + textStatus);
        }
    });
});

$("#addLocationForm").on("submit", function (e) {
    e.preventDefault();
    $.ajax({
        url: baseURL + "insertLocation.php",
        type: "POST",
        dataType: "json",
        data: {
            name: $("#addLocationName").val()
        },
        success: function (result) {
            if (result.status.code == 200) {
                $("#addLocationModal").modal('hide');
                refreshLocationTable();
            } else {
                alert("Error adding location: " + result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error adding location: " + textStatus);
        }
    });
});

// Location delete with dependency check
$(document).on('click', '.deleteLocationBtn', function() {
    const locId = $(this).attr('data-id');
    $.ajax({
        url: baseURL + "checkLocationDependencies.php",
        type: "POST",
        dataType: "json",
        data: { id: locId },
        success: function (result) {
            if (result.status.code == 200) {
                if (result.data.departmentCount > 0) {
                    alert("Cannot delete location - departments exist in this location");
                } else {
                    $("#deleteLocationID").val(locId);
                    $("#deleteLocationModal").modal('show');
                }
            }
        }
    });
});

$("#confirmDeleteLocation").click(function() {
    $.ajax({
        url: baseURL + "deleteLocationByID.php",
        type: "POST",
        dataType: "json",
        data: { id: $("#deleteLocationID").val() },
        success: function (result) {
            if (result.status.code == 200) {
                $("#deleteLocationModal").modal('hide');
                refreshLocationTable();
            } else {
                alert("Error deleting location: " + result.status.description);
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            alert("Error deleting location: " + textStatus);
        }
    });
});

// Filter form
$("#filterForm").on("submit", function (e) {
    e.preventDefault();
    currentFilter.department = $("#filterDepartment").val();
    currentFilter.location = $("#filterLocation").val();
    $("#filterModal").modal('hide');
    filterPersonnelTable($("#searchInp").val().toLowerCase());
});