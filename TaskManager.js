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
     * @param {String} caseType - The type of case to create ('incident', 'csm_case', 'hr_case', 'healthcare_claim', or 'pre_authorization').
     * @param {String} [shortDescription] - The short description of the case (not required for 'healthcare_claim' and 'pre_authorization').
     * @param {Number} [numCases=1] - The number of cases to create (only applicable for 'healthcare_claim' and 'pre_authorization').
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
                default:
                    gs.error('Invalid case type specified: ' + caseType);
                    return null;
            }

            if (caseType === 'healthcare_claim' || caseType === 'pre_authorization') {
                for (var i = 0; i < numCases; i++) {
                    var caseSysId;
                    if (caseType === 'healthcare_claim') {
                        caseSysId = this._createHealthcareClaim();
                    } else if (caseType === 'pre_authorization') {
                        caseSysId = this._createPreAuthorization();
                    }
                    if (caseSysId) {
                        caseSysIds.push(caseSysId);
                    } else {
                        gs.error('Failed to create ' + caseType + ' number ' + (i + 1));
                    }
                }
            } else {
                if (numCases > 1) {
                    gs.error('Creating multiple cases is only supported for healthcare claims and pre-authorizations.');
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
     * Creates a healthcare claim with generated data.
     * @returns {String|null} - The sys_id of the created healthcare claim, or null if failed.
     */
    _createHealthcareClaim: function() {
        // Array of medical procedures to diversify the claim names
        var procedures = [
            'Orthopedic Surgery', 'Dental Procedure', 'Cardiac Treatment', 'Physical Therapy',
            'Eye Examination', 'Maternity Care', 'Dermatology Consultation', 'Radiology Imaging',
            'Laboratory Tests', 'Emergency Room Visit', 'Vaccination Service', 'Mental Health Counseling',
            'Allergy Testing', 'Gastroenterology Procedure', 'Neurological Assessment'
        ];
        // Select a random procedure
        var procedure = procedures[Math.floor(Math.random() * procedures.length)];

        // Generate the name of the claim using GenAI
        var namePrompt = 'Generate a realistic healthcare claim title for a ' + procedure + ' service. Do not include quotation marks.';
        var name = this._generateUniqueContent(namePrompt);

        // Remove any leading or trailing quotation marks from the name
        name = name.replace(/^["']|["']$/g, '');

        // For type field, choose one of the specified values
        var types = ['institutional', 'oral', 'pharmacy', 'professional', 'vision'];
        var type = types[Math.floor(Math.random() * types.length)];

        // For patient field, pick a random value from the sn_hcls_patient table
        var patientSysId = this._getRandomRecordSysId('sn_hcls_patient');

        // Ensure patientSysId is valid
        if (!patientSysId) {
            gs.error('No patients found in sn_hcls_patient table.');
            return null;
        }

        // Generate random identification numbers
        var medicalRecordNo = this._generateRandomMedicalRecordNumber();
        var patientAccountNo = this._generateRandomPatientAccountNumber();

        // For member_plan, pick a random value from the sn_hcls_member_plan table
        var memberPlanSysId = this._getRandomRecordSysId('sn_hcls_member_plan');

        // For payer, pick a random value from the sn_hcls_organization table
        var payerSysId = this._getRandomRecordSysId('sn_hcls_organization');

        // For service_provider, pick a random value from sn_hcls_practitioner table
        var serviceProviderSysId = this._getRandomRecordSysId('sn_hcls_practitioner');

        // Generate random service provider ID
        var serviceProviderId = this._generateRandomServiceProviderId();

        // For preauth_header, pick a random value from sn_hcls_pre_auth_header table
        var preAuthHeaderSysId = this._getRandomRecordSysId('sn_hcls_pre_auth_header');

        // For status, choose one of the specified values
        var statuses = ['draft', 'entered-in-error', 'active', 'paid', 'in-hold', 'denied', 'cancelled', 'suspended'];
        var status = statuses[Math.floor(Math.random() * statuses.length)];

        // Generate random billed DRG code
        var billedDrgCode = this._generateRandomBilledDrgCode();

        // Generate remarks using GenAI and patient's name
        var patientName = this._getPatientName(patientSysId);
        var remarksPrompt = 'As a medical provider, write remarks for a healthcare claim for patient ' + patientName + ' who received ' + procedure + '.';
        var remarks = this._generateUniqueContent(remarksPrompt);

        // Generate required date fields using GlideDateTime
        var submittedDate = new GlideDateTime(); // Today

        var acceptedDate = new GlideDateTime();
        acceptedDate.addDaysLocalTime(2); // 2 days from now

        var adjudicatedDate = new GlideDateTime();
        adjudicatedDate.addDaysLocalTime(5); // 5 days from now

        var paymentDate = new GlideDateTime();
        paymentDate.addDaysLocalTime(10); // 10 days from now

        // Generate random amounts
        var claimAmount = this._generateRandomAmount(500, 5000); // Amount between $500 and $5000
        var adjudicatedAmount = this._generateRandomAmount(0, claimAmount); // Between $0 and claimAmount
        var feeReduction = this._generateRandomAmount(0, claimAmount - adjudicatedAmount);
        var patientPayAmount = (claimAmount - adjudicatedAmount - feeReduction).toFixed(2);

        // Build the fields object
        var fields = {
            name: name,
            type: type,
            patient: patientSysId,
            medical_record_no: medicalRecordNo,
            patient_account_no: patientAccountNo,
            member_plan: memberPlanSysId,
            payer: payerSysId,
            service_provider: serviceProviderSysId,
            service_provider_id: serviceProviderId,
            preauth_header: preAuthHeaderSysId,
            status: status,
            billed_drg_code: billedDrgCode,
            remarks: remarks,
            // Include the specified date fields
            submitted_date: submittedDate,
            accepted_date: acceptedDate,
            adjudicated_date: adjudicatedDate,
            payment_date: paymentDate,
            // Random amounts
            claim_amount: claimAmount,
            adjudicated_amount: adjudicatedAmount,
            fee_reduction: feeReduction,
            patient_pay_amount: patientPayAmount
        };

        // Create the healthcare claim record
        return this._createCaseRecord('sn_hcls_claim_header', fields);
    },

    /**
     * Creates a pre-authorization record with generated data.
     * @returns {String|null} - The sys_id of the created pre-authorization record, or null if failed.
     */
    _createPreAuthorization: function() {
        // Generate a unique number for the pre-authorization
        var number = this._generatePreAuthNumber();

        // For category, choose one of the specified values
        var categories = ['urgent', 'expedited', 'routine'];
        var category = categories[Math.floor(Math.random() * categories.length)];

        // For status, choose one of the specified values
        var statuses = ['Approved', 'Denied', 'Pending', 'In Progress'];
        var status = statuses[Math.floor(Math.random() * statuses.length)];

        // For type, choose one of the specified values
        var types = ['medical', 'pharmacy', 'dental', 'vision'];
        var type = types[Math.floor(Math.random() * types.length)];

        // For patient, pick a random value from the sn_hcls_patient table
        var patientSysId = this._getRandomRecordSysId('sn_hcls_patient');

        if (!patientSysId) {
            gs.error('No patients found in sn_hcls_patient table.');
            return null;
        }

        // For practitioner, pick a random value from the sn_hcls_practitioner table
        var practitionerSysId = this._getRandomRecordSysId('sn_hcls_practitioner');

        // For insurance, pick a random value from the sn_hcls_member_plan table
        var insuranceSysId = this._getRandomRecordSysId('sn_hcls_member_plan');

        // For prescription, pick a random value from the sn_hcls_medication table
        var prescriptionSysId = this._getRandomRecordSysId('sn_hcls_medication');

        // Generate a primary pre-authorization number
        var primaryPreAuthNum = 'PA' + this._generateRandomNumberString(8);

        // Use a list of more detailed predefined reasons and select one randomly
        var reasons = [
            'Patient presents with severe osteoarthritis of the knee causing significant mobility impairment; total knee replacement surgery is recommended to restore function and alleviate pain.',
            'Due to a recent myocardial infarction, the patient requires immediate cardiac catheterization and possible stent placement to prevent further cardiac damage.',
            'Patient has been diagnosed with stage II breast cancer; chemotherapy and radiation therapy are medically necessary as part of the treatment plan.',
            'Advanced imaging such as MRI is required to evaluate unexplained neurological symptoms including persistent headaches and vision disturbances.',
            'Patient suffers from chronic obstructive pulmonary disease (COPD) with frequent exacerbations; pulmonary rehabilitation therapy is essential to improve respiratory function.',
            'Patient has not responded to first-line medications for epilepsy; pre-authorization for new anti-epileptic medication is requested to control seizures.',
            'Orthodontic treatment is required to correct severe malocclusion impacting the patient\'s ability to chew and speak properly.',
            'Patient requires specialized biologic therapy for rheumatoid arthritis due to inadequate response to conventional disease-modifying antirheumatic drugs.'
        ];
        var reason = reasons[Math.floor(Math.random() * reasons.length)];

        // Generate notes using GenAI
        var patientName = this._getPatientName(patientSysId);
        var notesPrompt = 'Provide additional clinical notes for the pre-authorization request for patient ' + patientName + '.';
        var notes = this._generateUniqueContent(notesPrompt);

        // Generate dates
        var approvedDate = new GlideDateTime();
        approvedDate.addDaysLocalTime(2); // 2 days from now

        // Build the fields object
        var fields = {
            number: number,
            category: category,
            status: status,
            type: type,
            patient: patientSysId,
            practitioner: practitionerSysId,
            insurance: insuranceSysId,
            prescription: prescriptionSysId,
            primary_preauth_num: primaryPreAuthNum,
            reason: reason,
            notes: notes,
            approved_date: approvedDate
            // Additional fields can be populated as needed
        };

        // Create the pre-authorization record
        return this._createCaseRecord('sn_hcls_pre_auth_header', fields);
    },

    /**
     * Generates a unique pre-authorization number.
     * @returns {String} - The generated pre-authorization number.
     */
    _generatePreAuthNumber: function() {
        var gr = new GlideRecord('sn_hcls_pre_auth_header');
        gr.orderByDesc('number');
        gr.setLimit(1);
        gr.query();
        var lastNumber = 'PAUTH00000000';
        if (gr.next()) {
            lastNumber = gr.number.toString();
        }
        var numberInt = parseInt(lastNumber.replace('PAUTH', ''), 10);
        var newNumberInt = numberInt + 1;
        var newNumberStr = 'PAUTH' + newNumberInt.toString().padStart(8, '0');
        return newNumberStr;
    },

    /**
     * Generates a random amount between min and max.
     * @param {Number} min - The minimum amount.
     * @param {Number} max - The maximum amount.
     * @returns {String} - The generated random amount as a string with two decimal places.
     */
    _generateRandomAmount: function(min, max) {
        var amount = Math.random() * (max - min) + min;
        return amount.toFixed(2);
    },

    /**
     * Retrieves a random record's sys_id from the specified table.
     * @param {String} tableName - The name of the table to query.
     * @returns {String} - The sys_id of a random record, or an empty string if none found.
     */
    _getRandomRecordSysId: function(tableName) {
        var gr = new GlideRecord(tableName);
        gr.query();
        var records = [];
        while (gr.next()) {
            records.push(gr.getUniqueValue());
        }
        if (records.length > 0) {
            // Return a random record's sys_id from the list
            return records[Math.floor(Math.random() * records.length)];
        }
        // Return empty string if no records found
        return '';
    },

    /**
     * Generates a random number string of specified length.
     * @param {Number} length - The length of the number string to generate.
     * @returns {String} - The generated random number string.
     */
    _generateRandomNumberString: function(length) {
        var result = '';
        for (var i = 0; i < length; i++) {
            result += Math.floor(Math.random() * 10).toString();
        }
        return result;
    },

    /**
     * Generates a random medical record number.
     * @returns {String} - The generated medical record number.
     */
    _generateRandomMedicalRecordNumber: function() {
        return 'MRN' + this._generateRandomNumberString(6);
    },

    /**
     * Generates a random patient account number.
     * @returns {String} - The generated patient account number.
     */
    _generateRandomPatientAccountNumber: function() {
        return 'PAN' + this._generateRandomNumberString(8);
    },

    /**
     * Generates a random service provider ID.
     * @returns {String} - The generated service provider ID.
     */
    _generateRandomServiceProviderId: function() {
        return 'SPID' + this._generateRandomNumberString(5);
    },

    /**
     * Generates a random billed DRG code.
     * @returns {String} - The generated billed DRG code.
     */
    _generateRandomBilledDrgCode: function() {
        return 'DRG' + this._generateRandomNumberString(3);
    },

    /**
     * Retrieves the name of the patient based on their sys_id.
     * @param {String} patientSysId - The sys_id of the patient.
     * @returns {String} - The name of the patient, or a default value if not found.
     */
    _getPatientName: function(patientSysId) {
        var patientGr = new GlideRecord('sn_hcls_patient');
        if (patientGr.get(patientSysId)) {
            return patientGr.getDisplayValue('name');
        }
        return 'the patient';
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
            var prompt = promptTemplates[i].replace('{shortDescription}', shortDescription).replace('{ciName}', ciName).replace('{userName}', userName);

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
            return ciGr.getDisplayValue('name');
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
            return userGr.getDisplayValue('name');
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

    type: 'TaskManager'
};
