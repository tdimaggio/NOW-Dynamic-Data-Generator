var TaskManager = Class.create();

TaskManager.prototype = {
    // Constants for sys_id values with descriptive names
    INCIDENT_END_USER_SYSID: '62826bf03710200044e0bfc8bcbe5df1', // Sys_id of the incident caller (end user)
    CONFIGURATION_ITEM_SYSID: '3a6cdbdbc0a8ce01008ef85f28b07a41', // Sys_id of the configuration item (CI)
    BUSINESS_SERVICE_SYSID: '26da329f0a0a0bb400f69d8159bc753d', // Sys_id of the business service
    INCIDENT_ASSIGNMENT_GROUP_SYSID: '287ebd7da9fe198100f92cc8d1d2154e', // Sys_id of the incident assignment group
    INCIDENT_LOCATION_SYSID: '29a6c6bc0a0a0b5000d1f9d758c21531', // Sys_id of the incident location
    CSM_CONTACT_SYSID: '60beb5e7d7600200e5982cf65e6103ad', // Sys_id of the CSM contact
    CSM_ACCOUNT_SYSID: '1b7346d4c6112276007f9d0efdb69cd2', // Sys_id of the CSM account
    CSM_PRODUCT_SYSID: '9f8d1294c6112276007f9d0efdb69cdb', // Sys_id of the CSM product
    CSM_AGENT_SYSID: '46d44a5dc6112276007f9d0efdb69cd4', // Sys_id of the CSM agent
    HR_CASE_OPENED_FOR_SYSID: '3fc87b58931eca10800fb45e1dba105c', // Sys_id of the user the HR case is opened for
    HR_SUBJECT_PERSON_SYSID: '3fc87b58931eca10800fb45e1dba105c', // Sys_id of the HR subject person
    HR_ASSIGNMENT_GROUP_SYSID: 'd625dccec0a8016700a222a0f7900d6c', // Sys_id of the HR assignment group
    HR_SERVICE_SYSID: 'e228cde49f331200d9011977677fcf05', // Sys_id of the HR service
    AGENT_USER_SYSID: 'a8f98bb0eb32010045e1a5115206fe3a', // Sys_id of the agent user

    initialize: function() {
        // Initialization function (empty in this case)
    },

    /**
     * Creates a case of the specified type with the given short description.
     * @param {String} caseType - The type of case to create ('incident', 'csm_case', or 'hr_case').
     * @param {String} shortDescription - The short description of the case.
     */
    createCase: function(caseType, shortDescription) {
        if (!caseType || !shortDescription) {
            gs.error('Case type and short description must be provided.');
            return;
        }

        var caseSysId;
        var tableName;

        try {
            // Determine the type of case to create and call the appropriate function
            switch (caseType) {
                case 'incident':
                    caseSysId = this._createIncident(shortDescription);
                    tableName = 'incident';
                    break;
                case 'csm_case':
                    caseSysId = this._createCSMCase(shortDescription);
                    tableName = 'sn_customerservice_case';
                    break;
                case 'hr_case':
                    caseSysId = this._createHRCase(shortDescription);
                    tableName = 'sn_hr_core_case';
                    break;
                default:
                    gs.error('Invalid case type specified: ' + caseType);
                    return;
            }

            if (caseSysId) {
                // Generate entries (comments and work notes) for the case
                var entries = this._generateEntries(shortDescription);
                // Add comments and work notes to the case
                this._addCommentsAndWorkNotes(tableName, caseSysId, entries);
                // Add an attachment to the case
                this._addAttachment(
                    tableName,
                    caseSysId,
                    'error_log.txt',
                    this._generateUniqueContent('Generate a log snippet for the issue: "' + shortDescription + '".')
                );
            } else {
                gs.error('Failed to create case of type: ' + caseType);
            }
        } catch (error) {
            gs.error('Error in createCase: ' + error.message);
        }
    },

    /**
     * Creates a new record in the specified table with the given fields.
     * @param {String} tableName - The name of the table to insert the record into.
     * @param {Object} fields - An object containing field names and values to set on the record.
     * @returns {String|null} - The sys_id of the created record, or null if failed.
     */
    _createCaseRecord: function(tableName, fields) {
        if (!fields.short_description || !fields.opened_by) {
            gs.error('Required fields are missing for table ' + tableName);
            return null;
        }

        var gr = new GlideRecord(tableName);
        gr.initialize();
        // Set field values from the fields object
        for (var field in fields) {
            gr.setValue(field, fields[field]);
        }
        var sysId = gr.insert();
        if (!sysId) {
            gs.error('Failed to insert record into ' + tableName);
        }
        return sysId;
    },

    /**
     * Creates an incident with the specified short description.
     * @param {String} shortDescription - The short description of the incident.
     * @returns {String|null} - The sys_id of the created incident, or null if failed.
     */
    _createIncident: function(shortDescription) {
        // Generate a detailed description for the incident
        var detailedDescription = this._generateDetailedDescription(shortDescription);

        var fields = {
            short_description: shortDescription,
            description: detailedDescription,
            caller_id: this.INCIDENT_END_USER_SYSID,
            cmdb_ci: this.CONFIGURATION_ITEM_SYSID,
            business_service: this.BUSINESS_SERVICE_SYSID,
            impact: 1,
            urgency: 1,
            priority: 1,
            category: 'Network',
            subcategory: 'Email',
            assignment_group: this.INCIDENT_ASSIGNMENT_GROUP_SYSID,
            state: 1, // New
            opened_by: this.INCIDENT_END_USER_SYSID,
            location: this.INCIDENT_LOCATION_SYSID
        };
        // Create the incident record
        return this._createCaseRecord('incident', fields);
    },

    /**
     * Creates a CSM case with the specified short description.
     * @param {String} shortDescription - The short description of the case.
     * @returns {String|null} - The sys_id of the created CSM case, or null if failed.
     */
    _createCSMCase: function(shortDescription) {
        // Generate a detailed description for the CSM case
        var detailedDescription = this._generateDetailedDescription(shortDescription);

        var fields = {
            short_description: shortDescription,
            description: detailedDescription,
            contact: this.CSM_CONTACT_SYSID,
            account: this.CSM_ACCOUNT_SYSID,
            product: this.CSM_PRODUCT_SYSID,
            priority: 2,
            severity: 2,
            assigned_to: this.CSM_AGENT_SYSID,
            opened_by: this.CSM_CONTACT_SYSID
        };
        // Create the CSM case record
        return this._createCaseRecord('sn_customerservice_case', fields);
    },

    /**
     * Creates an HR case with the specified short description.
     * @param {String} shortDescription - The short description of the HR case.
     * @returns {String|null} - The sys_id of the created HR case, or null if failed.
     */
    _createHRCase: function(shortDescription) {
        // Generate a detailed description for the HR case
        var detailedDescription = this._generateDetailedDescription(shortDescription);

        // Calculate due date (5 days from now)
        var dueDate = new GlideDateTime();
        dueDate.addDaysLocalTime(5);

        var fields = {
            short_description: shortDescription,
            description: detailedDescription,
            opened_for: this.HR_CASE_OPENED_FOR_SYSID,
            hr_service: this.HR_SERVICE_SYSID,
            subject_person: this.HR_SUBJECT_PERSON_SYSID,
            assignment_group: this.HR_ASSIGNMENT_GROUP_SYSID,
            hr_service_type: 'employee_relations',
            due_date: dueDate,
            opened_by: this.HR_CASE_OPENED_FOR_SYSID
        };
        // Create the HR case record
        return this._createCaseRecord('sn_hr_core_case', fields);
    },

    /**
     * Generates a detailed description for the case based on the short description.
     * @param {String} shortDescription - The short description of the case.
     * @returns {String} - The generated detailed description.
     */
    _generateDetailedDescription: function(shortDescription) {
        var prompt = 'Provide a detailed description for the issue: "' + shortDescription + '". Include possible causes and the impact on the user.';
        // Generate unique content based on the prompt
        return this._generateUniqueContent(prompt);
    },

    /**
     * Generates a prompt by replacing placeholders in the template with the short description.
     * @param {String} template - The template string containing placeholders.
     * @param {String} shortDescription - The short description to insert into the template.
     * @returns {String} - The generated prompt.
     */
    _generatePrompt: function(template, shortDescription) {
        return template.replace('{shortDescription}', shortDescription);
    },

    /**
     * Generates entries (comments and work notes) for the case based on the short description.
     * @param {String} shortDescription - The short description of the case.
     * @returns {Array} - An array of entry objects containing type, text, and user.
     */
    _generateEntries: function(shortDescription) {
        // Templates for generating prompts
        var promptTemplates = [
            'As an end-user, report the issue "{shortDescription}" including any error messages you encountered.',
            'As a support agent, write a work note detailing the initial troubleshooting steps taken for "{shortDescription}", including tools used and findings.',
            'As the end-user, provide an update on whether the issue "{shortDescription}" persists after initial troubleshooting, and mention any new symptoms.',
            'As a support agent, document additional diagnostic steps performed for "{shortDescription}", and note any anomalies observed.',
            'As the end-user, supply additional details, including exact error codes and the impact on your work due to "{shortDescription}".',
            'As a support agent, outline the resolution steps taken to address "{shortDescription}", and confirm if the issue is resolved.',
            'As the end-user, confirm the resolution of "{shortDescription}" and express gratitude or any remaining concerns.'
        ];

        var entries = [];
        // Get the name of the configuration item and the user's name
        var ciName = this._getConfigurationItemName();
        var userName = this._getUserName(this.INCIDENT_END_USER_SYSID);

        for (var i = 0; i < promptTemplates.length; i++) {
            // Generate the prompt by replacing placeholders
            var prompt = this._generatePrompt(promptTemplates[i], shortDescription);
            prompt = prompt.replace('{ciName}', ciName).replace('{userName}', userName);

            // Generate unique content based on the prompt
            var content = this._generateUniqueContent(prompt);
            // Determine the entry type (comment or work note)
            var entryType = i % 2 === 0 ? 'comment' : 'work_note';
            // Determine the user (end user for comments, agent for work notes)
            var user = entryType === 'comment' ? this.INCIDENT_END_USER_SYSID : this.AGENT_USER_SYSID;
            entries.push({ type: entryType, text: content, user: user });
        }

        return entries;
    },

    /**
     * Adds comments and work notes to the specified case.
     * @param {String} tableName - The name of the table containing the case.
     * @param {String} caseSysId - The sys_id of the case record.
     * @param {Array} entries - An array of entries to add to the case.
     */
    _addCommentsAndWorkNotes: function(tableName, caseSysId, entries) {
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];

            // Impersonate the user
            var impUser = new GlideImpersonate();
            impUser.impersonate(entry.user);

            var caseUpdate = new GlideRecord(tableName);
            if (caseUpdate.get(caseSysId)) {
                // Add the comment or work note to the case
                if (entry.type === 'comment') {
                    caseUpdate.comments = entry.text;
                } else {
                    caseUpdate.work_notes = entry.text;
                }
                caseUpdate.update();
            }

            // Revert impersonation
            impUser.unimpersonate();
        }
    },

    /**
     * Generates unique content based on the provided prompt by calling an external API.
     * @param {String} prompt - The prompt to generate content from.
     * @returns {String} - The generated unique content.
     */
    _generateUniqueContent: function(prompt) {
        var request = {
            "executionRequests": [
                {
                    "payload": {
                        "prompt": prompt
                    },
                    "capabilityId": "0c90ca79533121106b38ddeeff7b12d7"
                }
            ]
        };

        // Execute the request using OneExtendUtil
        var response = sn_one_extend.OneExtendUtil.execute(request);

        if (response && response.capabilities && response.capabilities["0c90ca79533121106b38ddeeff7b12d7"]) {
            var uniqueContent = response.capabilities["0c90ca79533121106b38ddeeff7b12d7"].response;
            return uniqueContent;
        } else {
            gs.error('Error generating unique content.');
            return 'Unable to generate content at this time.';
        }
    },

    /**
     * Retrieves the name of the configuration item based on its sys_id.
     * @returns {String} - The name of the configuration item, or a default value if not found.
     */
    _getConfigurationItemName: function() {
        var ciGr = new GlideRecord('cmdb_ci');
        if (ciGr.get(this.CONFIGURATION_ITEM_SYSID)) {
            return ciGr.getValue('name');
        }
        return 'the affected system';
    },

    /**
     * Retrieves the name of the user based on their sys_id.
     * @param {String} userSysId - The sys_id of the user.
     * @returns {String} - The name of the user, or a default value if not found.
     */
    _getUserName: function(userSysId) {
        var userGr = new GlideRecord('sys_user');
        if (userGr.get(userSysId)) {
            return userGr.getValue('name');
        }
        return 'the user';
    },

    /**
     * Adds an attachment to the specified case.
     * @param {String} tableName - The name of the table containing the case.
     * @param {String} caseSysId - The sys_id of the case record.
     * @param {String} fileName - The name of the attachment file.
     * @param {String} fileContent - The content of the attachment file.
     */
    _addAttachment: function(tableName, caseSysId, fileName, fileContent) {
        var attachment = new GlideSysAttachment();
        attachment.write(tableName, caseSysId, fileName, 'text/plain', fileContent);
    },

    /**
     * Retrieves a random user's sys_id who has the specified role.
     * @param {String} role - The role to filter users by.
     * @returns {String} - The sys_id of a random user with the role, or the current user if none found.
     */
    _getRandomUserSysId: function(role) {
        var userGr = new GlideRecord('sys_user');
        userGr.addQuery('roles', 'CONTAINS', role);
        userGr.query();
        var users = [];
        while (userGr.next()) {
            users.push(userGr.getUniqueValue());
        }
        if (users.length > 0) {
            // Return a random user from the list
            return users[Math.floor(Math.random() * users.length)];
        }
        // Return the current user's sys_id if no users found
        return gs.getUserID();
    },

    type: 'TaskManager'
};
