export class SolutionService {

    constructor(dataverseClient) {
        this.client = dataverseClient;
    }

    async getSolutions() {

        const query =
            "solutions" +
            "?$select=" +
            "solutionid," +
            "uniquename," +
            "friendlyname," +
            "version," +
            "ismanaged" +
            "&$filter=isvisible eq true" +
            "&$orderby=friendlyname";

        const response =
            await this.client.get(query);

        return response.value;
    }
}