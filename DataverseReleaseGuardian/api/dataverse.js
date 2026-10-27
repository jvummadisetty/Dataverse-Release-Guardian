export class DataverseClient {

    constructor(baseUrl, accessToken) {
        this.baseUrl = baseUrl;
        this.accessToken = accessToken;
    }

    async get(endpoint) {

        const response = await fetch(
            `${this.baseUrl}/api/data/v9.2/${endpoint}`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${this.accessToken}`,

                    "Accept":
                        "application/json",

                    "OData-MaxVersion":
                        "4.0",

                    "OData-Version":
                        "4.0"
                }
            }
        );

        if (!response.ok) {

            const errorText =
                await response.text();

            throw new Error(
                `Dataverse error ${response.status}: ${errorText}`
            );
        }

        return await response.json();
    }
}