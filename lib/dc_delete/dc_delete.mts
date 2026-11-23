import mysql, { Pool } from "mysql2"

const pool: Pool = mysql.createPool({
  host: process.env.RDS_HOST!,
  user: process.env.RDS_USER!,
  password: process.env.RDS_PASSWORD!,
  database: process.env.RDS_DATABASE!,
})

export const handler = async (event: any): Promise<String | any | undefined> => {
    let code
    let result

    try {
        //const userId: string = JSON.parse(event.body).userId
        const userId = "ac"//currently a test value, as I dont want to delete any of our databases with actual data
        
        return new Promise((resolve, reject) => {
            const selectQuery = "DELETE FROM DonationCenter WHERE ? "
            pool.query(selectQuery, [userId], (error, results) => {
                if (error) return error
                if (Array.isArray(results) && results.length > 1){
                    return "uh oh"
                }
                if (Array.isArray(results) && results.length == 1){
                    return results
                }
            })
        })
    } catch (error) {
        result = error instanceof Error ? error.message : "An Error has occurred"
        
    
    }
    const response = {
        statusCode: code,
        headers: {
            "Access-Control-Allow-Origin": "http://localhost:3000",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        },
        result: JSON.stringify(result)
    }
    return response
}