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
     * @param {String} caseType - The type of case to create ('incident', 'csm_case', 'hr_case', 'healthcare_claim', 'pre_authorization', or 'claim_dispute').
     * @param {String} [shortDescription] - The short description of the case (not required for some case types).
     * @param {Number} [numCases=1] - The number of cases to create (only applicable for certain case types).
     * @returns {Array|String|null} - The sys_id(s) of the created case(s), or null if failed.
     */
    createCase: function(caseType, shortDescription, numCases) {
        if (!caseType) {
            gs.error('Case type must be provided.');
            return null;
        }

        numCases = numCases || 1; // Default to 1 if not provided

        var caseSysIds = [];
        var tableName;

        try {
            // Determine the table name based on case type
            switch (caseType) {
                case 'incident':
                    if (!shortDescription) {
                        gs.error('Short description must be provided for incidents.');
                        return null;
                    }
                    tableName = 'incident';
                    break;
                case 'csm_case':
                    if (!shortDescription) {
                        gs.error('Short description must be provided for CSM cases.');
                        return null;
                    }
                    tableName = 'sn_customerservice_case';
                    break;
                case 'hr_case':
                    if (!shortDescription) {
                        gs.error('Short description must be provided for HR cases.');
                        return null;
                    }
                    tableName = 'sn_hr_core_case';
                    break;
                case 'healthcare_claim':
                    tableName = 'sn_hcls_claim_header';
                    break;
                case 'pre_authorization':
                    tableName = 'sn_hcls_pre_auth_header';
                    break;
                case 'claim_dispute':
                    tableName = 'u_claimdispute';
                    break;
                default:
                    gs.error('Invalid case type specified: ' + caseType);
                    return null;
            }

            if (caseType === 'healthcare_claim' || caseType === 'pre_authorization' || caseType === 'claim_dispute') {
                for (var i = 0; i < numCases; i++) {
                    var caseSysId;
                    if (caseType === 'healthcare_claim') {
                        caseSysId = this._createHealthcareClaim();
                    } else if (caseType === 'pre_authorization') {
                        caseSysId = this._createPreAuthorization();
                    } else if (caseType === 'claim_dispute') {
                        caseSysId = this._createClaimDispute();
                    }
                    if (caseSysId) {
                        caseSysIds.push(caseSysId);
                    } else {
                        gs.error('Failed to create ' + caseType + ' number ' + (i + 1));
                    }
                }
            } else {
                if (numCases > 1) {
                    gs.error('Creating multiple cases is only supported for healthcare claims, pre-authorizations, and claim disputes.');
                    return null;
                }
                var caseSysId;
                if (caseType === 'incident') {
                    caseSysId = this._createIncident(shortDescription);
                } else if (caseType === 'csm_case') {
                    caseSysId = this._createCSMCase(shortDescription);
                } else if (caseType === 'hr_case') {
                    caseSysId = this._createHRCase(shortDescription);
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
                    caseSysIds.push(caseSysId);
                } else {
                    gs.error('Failed to create case of type: ' + caseType);
                    return null;
                }
            }

            // Return the sys_id(s) of the created case(s)
            return caseSysIds.length === 1 ? caseSysIds[0] : caseSysIds;

        } catch (error) {
            gs.error('Error in createCase: ' + error.message);
            return null;
        }
    },

    /**
     * Creates a new record in the specified table with the given fields.
     * @param {String} tableName - The name of the table to insert the record into.
     * @param {Object} fields - An object containing field names and values to set on the record.
     * @returns {String|null} - The sys_id of the created record, or null if failed.
     */
    _createCaseRecord: function(tableName, fields) {
        var gr = new GlideRecord(tableName);
        gr.initialize();
        // Set field values from the fields object
        for (var field in fields) {
            gr.setValue(field, fields[field]);
        }
        var sysId = gr.insert();
        if (!sysId) {
            gs.error('Failed to insert record into ' + tableName + '. Error: ' + gr.getLastErrorMessage());
        }
        return sysId;
    },

    /**
     * Creates a Claim Dispute record with generated data.
     * @returns {String|null} - The sys_id of the created Claim Dispute record, or null if failed.
     */
    _createClaimDispute: function() {
        // Generate data for the Claim Dispute record
        var claimNumber = this._generateClaimDisputeNumber();

        // Get a random patient from the sn_hcls_patient table
        var patientSysId = this._getRandomRecordSysId('sn_hcls_patient');

        // If no patient is found, create a dummy patient record
        if (!patientSysId) {
            gs.warn('No patients found in sn_hcls_patient table. Creating a dummy patient record.');
            patientSysId = this._createDummyPatient();
            if (!patientSysId) {
                gs.error('Failed to create a dummy patient record.');
                return null;
            }
        }

        var patientGr = new GlideRecord('sn_hcls_patient');
        if (patientGr.get(patientSysId)) {
            var patientName = patientGr.getValue('name') || 'Unknown Patient';
        } else {
            gs.error('Failed to retrieve patient record.');
            return null;
        }

        // Generate denial code and reason
        var denialCodes = ['CO 16', 'PR 204', 'OA 18', 'CO 50'];
        var denialCode = denialCodes[Math.floor(Math.random() * denialCodes.length)];

        var reasonForDenial = 'Services not covered under the patient\'s benefit plan.';

        // Generate requested procedure
        var procedures = [
            'Atypical Nevus Removal',
            'Congenital Nevus Removal',
            'Knee Arthroscopy',
            'Spinal Fusion Surgery',
            'Cardiac Catheterization'
        ];
        var requestedProcedure = procedures[Math.floor(Math.random() * procedures.length)];

        // Generate additional details
        var physicianNames = ['Dr. John Smith', 'Dr. Emily Brown', 'Dr. James Dean', 'Dr. Lisa White'];
        var physicianName = physicianNames[Math.floor(Math.random() * physicianNames.length)];

        // Generate the initial determination
        var initialDeterminations = ['Adverse', 'Favorable'];
        var initialDetermination = initialDeterminations[Math.floor(Math.random() * initialDeterminations.length)];

        // Generate initial determination date
        var initialDeterminationDate = new GlideDateTime();
        initialDeterminationDate.addDaysLocalTime(-10); // 10 days ago

        // Find any pre-authorizations that match the patient
        var preAuthSysId = this._findPreAuthorization(patientSysId);

        // Build the fields object
        var fields = {
            number: claimNumber,
            u_member: patientSysId, // Assign patientSysId to u_member
            u_patient_name: patientName,
            u_denial_code: denialCode,
            u_reason_for_denial: reasonForDenial,
            u_requested_procedure: requestedProcedure,
            u_physician_name: physicianName,
            u_initial_determination: initialDetermination,
            u_initial_determination_date: initialDeterminationDate,
            u_pre_auth_request: preAuthSysId || '',
            u_mrn: this._generateRandomMedicalRecordNumber(),
            u_source: 'Provider',
            u_secondary_diagnosis_of_concern: 'Hypertension',
            state: 1, // New
            priority: 3,
            short_description: 'Claim dispute for ' + patientName,
            description: 'Patient ' + patientName + ' is disputing the claim denial for ' + requestedProcedure + '.',
            assigned_to: this.AGENT_USER_SYSID,
            opened_by: this.AGENT_USER_SYSID,
            opened_at: new GlideDateTime()
        };

        // Create the Claim Dispute record
        return this._createCaseRecord('u_claimdispute', fields);
    },

    /**
     * Generates a unique Claim Dispute number.
     * @returns {String} - The generated Claim Dispute number.
     */
    _generateClaimDisputeNumber: function() {
        var gr = new GlideRecord('u_claimdispute');
        gr.orderByDesc('number');
        gr.setLimit(1);
        gr.query();
        var lastNumber = 'CD0000000';
        if (gr.next()) {
            lastNumber = gr.number.toString();
        }
        var numberInt = parseInt(lastNumber.replace('CD', ''), 10);
        var newNumberInt = numberInt + 1;
        var newNumberStr = 'CD' + newNumberInt.toString().padStart(7, '0');
        return newNumberStr;
    },

    /**
     * Finds a pre-authorization that matches the given patient.
     * @param {String} patientSysId - The sys_id of the patient.
     * @returns {String|null} - The sys_id of the matching pre-authorization, or null if none found.
     */
    _findPreAuthorization: function(patientSysId) {
        var gr = new GlideRecord('sn_hcls_pre_auth_header');
        gr.addQuery('patient', patientSysId);
        gr.setLimit(1);
        gr.query();
        if (gr.next()) {
            return gr.getUniqueValue();
        }
        return null;
    },

    /**
     * Retrieves a random record sys_id from the specified table.
     * @param {String} tableName - The name of the table.
     * @returns {String|null} - The sys_id of the random record, or null if none found.
     */
    _getRandomRecordSysId: function(tableName) {
        // Use GlideAggregate to get the count efficiently
        var agg = new GlideAggregate(tableName);
        agg.addAggregate('COUNT');
        agg.query();
        var count = 0;
        if (agg.next()) {
            count = parseInt(agg.getAggregate('COUNT'), 10);
        }
        if (count === 0) {
            return null;
        }
        // Generate a random offset
        var randomOffset = Math.floor(Math.random() * count);
        // Query the table with the random offset
        var gr = new GlideRecord(tableName);
        gr.chooseWindow(randomOffset, randomOffset);
        gr.query();
        if (gr.next()) {
            return gr.getUniqueValue();
        }
        return null;
    },

    /**
     * Creates a dummy patient record for testing purposes.
     * @returns {String|null} - The sys_id of the created patient record, or null if failed.
     */
    _createDummyPatient: function() {
        var gr = new GlideRecord('sn_hcls_patient');
        gr.initialize();
        gr.name = 'John Doe';
        gr.date_of_birth = '1980-01-01';
        gr.gender = 'male';
        gr.address = '123 Main St, Anytown, USA';
        var sysId = gr.insert();
        if (!sysId) {
            gs.error('Failed to insert dummy patient record into sn_hcls_patient table. Error: ' + gr.getLastErrorMessage());
            return null;
        }
        return sysId;
    },

    /**
     * Generates a random medical record number.
     * @returns {String} - The generated medical record number.
     */
    _generateRandomMedicalRecordNumber: function() {
        return 'MRN' + Math.floor(100000 + Math.random() * 900000);
    },

    /**
     * Creates an incident with the specified short description.
     * @param {String} shortDescription - The short description of the incident.
     * @returns {String|null} - The sys_id of the created incident, or null if failed.
     */
    _createIncident: function(shortDescription) {
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
     * Generates a detailed description for a case based on the short description.
     * @param {String} shortDescription - The short description of the case.
     * @returns {String} - The generated detailed description.
     */
    _generateDetailedDescription: function(shortDescription) {
        return 'Detailed description for: ' + shortDescription;
    },

    /**
     * Generates entries (comments and work notes) for the case.
     * @param {String} shortDescription - The short description of the case.
     * @returns {Array} - An array of entries.
     */
    _generateEntries: function(shortDescription) {
        return [
            { type: 'comment', text: 'Comment about ' + shortDescription },
            { type: 'work_note', text: 'Work note for ' + shortDescription }
        ];
    },

    /**
     * Adds comments and work notes to the case.
     * @param {String} tableName - The name of the table.
     * @param {String} caseSysId - The sys_id of the case.
     * @param {Array} entries - An array of entries to add.
     */
    _addCommentsAndWorkNotes: function(tableName, caseSysId, entries) {
        var gr = new GlideRecord(tableName);
        if (gr.get(caseSysId)) {
            entries.forEach(function(entry) {
                if (entry.type === 'comment') {
                    gr.comments = entry.text;
                } else if (entry.type === 'work_note') {
                    gr.work_notes = entry.text;
                }
                gr.update();
            });
        }
    },

    /**
     * Generates unique content based on the provided prompt.
     * @param {String} prompt - The prompt to generate content from.
     * @returns {String} - The generated content.
     */
    _generateUniqueContent: function(prompt) {
        return 'Generated content based on prompt: ' + prompt;
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

    type: 'TaskManager'
};
