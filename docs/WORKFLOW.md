{
  "info": {
    "name": "HRMS Workflow Engine",
    "description": "Phase 5.5 — Generic workflow templates, instances, approvals",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:5000/api/v1" },
    { "key": "accessToken", "value": "" },
    { "key": "instanceId", "value": "" },
    { "key": "templateId", "value": "" }
  ],
  "item": [
    {
      "name": "Templates",
      "item": [
        {
          "name": "List Templates",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}" }],
            "url": "{{baseUrl}}/workflow/templates"
          }
        },
        {
          "name": "Create Template",
          "request": {
            "method": "POST",
            "header": [
              { "key": "Authorization", "value": "Bearer {{accessToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\"name\":\"Custom Leave\",\"workflowType\":\"leave\",\"levels\":[{\"name\":\"Manager\",\"levelOrder\":1,\"approverType\":\"reporting_manager\"},{\"name\":\"HR\",\"levelOrder\":2,\"approverType\":\"hr\"}]}"
            },
            "url": "{{baseUrl}}/workflow/templates"
          }
        },
        {
          "name": "Get Template",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}" }],
            "url": "{{baseUrl}}/workflow/templates/{{templateId}}"
          }
        }
      ]
    },
    {
      "name": "Instances",
      "item": [
        {
          "name": "List Instances",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}" }],
            "url": "{{baseUrl}}/workflow/instances?status=pending"
          }
        },
        {
          "name": "Get Instance",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}" }],
            "url": "{{baseUrl}}/workflow/instances/{{instanceId}}"
          }
        },
        {
          "name": "Get History",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}" }],
            "url": "{{baseUrl}}/workflow/instances/{{instanceId}}/history"
          }
        },
        {
          "name": "Approve",
          "request": {
            "method": "PUT",
            "header": [
              { "key": "Authorization", "value": "Bearer {{accessToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "body": { "mode": "raw", "raw": "{\"comment\":\"Approved\"}" },
            "url": "{{baseUrl}}/workflow/instances/{{instanceId}}/approve"
          }
        },
        {
          "name": "Reject",
          "request": {
            "method": "PUT",
            "header": [
              { "key": "Authorization", "value": "Bearer {{accessToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "body": { "mode": "raw", "raw": "{\"comment\":\"Rejected\"}" },
            "url": "{{baseUrl}}/workflow/instances/{{instanceId}}/reject"
          }
        },
        {
          "name": "Delegate",
          "request": {
            "method": "PUT",
            "header": [
              { "key": "Authorization", "value": "Bearer {{accessToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "body": { "mode": "raw", "raw": "{\"delegateId\":\"USER_ID\",\"comment\":\"On leave\"}" },
            "url": "{{baseUrl}}/workflow/instances/{{instanceId}}/delegate"
          }
        },
        {
          "name": "Escalate",
          "request": {
            "method": "PUT",
            "header": [
              { "key": "Authorization", "value": "Bearer {{accessToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "body": { "mode": "raw", "raw": "{\"comment\":\"SLA breach\"}" },
            "url": "{{baseUrl}}/workflow/instances/{{instanceId}}/escalate"
          }
        }
      ]
    },
    {
      "name": "Dashboard & Reports",
      "item": [
        {
          "name": "Pending Approvals",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}" }],
            "url": "{{baseUrl}}/workflow/pending"
          }
        },
        {
          "name": "Dashboard",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}" }],
            "url": "{{baseUrl}}/workflow/dashboard"
          }
        },
        {
          "name": "Analytics Report",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}" }],
            "url": "{{baseUrl}}/workflow/reports/analytics"
          }
        },
        {
          "name": "SLA Report",
          "request": {
            "method": "GET",
            "header": [{ "key": "Authorization", "value": "Bearer {{accessToken}}" }],
            "url": "{{baseUrl}}/workflow/reports/sla"
          }
        }
      ]
    },
    {
      "name": "Delegation",
      "item": [
        {
          "name": "Create Delegation",
          "request": {
            "method": "POST",
            "header": [
              { "key": "Authorization", "value": "Bearer {{accessToken}}" },
              { "key": "Content-Type", "value": "application/json" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\"delegatorId\":\"MANAGER_ID\",\"delegateId\":\"DELEGATE_ID\",\"startDate\":\"2026-07-01\",\"endDate\":\"2026-07-31\",\"reason\":\"On leave\"}"
            },
            "url": "{{baseUrl}}/workflow/delegations"
          }
        }
      ]
    }
  ]
}
