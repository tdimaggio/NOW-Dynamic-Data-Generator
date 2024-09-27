// Example 1: Basic usage in a server-side script (e.g., Background Script)
var taskManager = new TaskManager();
taskManager.createCase('incident', 'Network connectivity issues in the marketing department');

// Example 2: Usage in a Business Rule
(function executeRule(current, previous /*null when async*/) {
    var taskManager = new TaskManager();
    taskManager.createCase('csm_case', current.short_description);
})(current, previous);

// Example 3: Usage in a Scheduled Job
var taskManager = new TaskManager();
taskManager.createCase('hr_case', 'Annual performance review process initiation');

// Example 4: Usage in a UI Action script
function onExecute() {
    var taskManager = new TaskManager();
    taskManager.createCase('incident', g_form.getValue('short_description'));
    return false; // Prevent form submission if needed
}

// Example 5: Usage in a Scripted REST API
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    var taskManager = new TaskManager();
    var caseType = request.queryParams.case_type;
    var shortDescription = request.queryParams.short_description;
    
    if (caseType && shortDescription) {
        taskManager.createCase(caseType, shortDescription);
        response.setStatus(201);
        response.setBody("Case created successfully");
    } else {
        response.setStatus(400);
        response.setBody("Missing required parameters");
    }
})(request, response);