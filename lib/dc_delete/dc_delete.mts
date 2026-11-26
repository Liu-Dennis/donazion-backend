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

    console.log("Programming is a sin")

    try {
        //currenlt let for testing, reset later
        let userId: string = JSON.parse(event.body).userId
        //console.log(userId)
        //userId = "ac"//currently a test value, as I dont want to delete any of our databases with actual data
        
        const deleteDC =  () => {
            return new Promise((resolve, reject) => {
                const selectQuery = "DELETE FROM DonationCenter WHERE DonationCenter.dc_id = ?"
                pool.query<mysql.ResultSetHeader>(selectQuery, [userId], (error, results) => {
                    //console.log(error)
                    //console.log(results)
                    if (error) {
                        code = 400
                        return reject(error)
                    }
                    if (results.affectedRows > 1){
                        code = 400
                        return resolve("Error: Multiple Donation Centers Deleted")
                    } else if (results.affectedRows == 1){
                        code = 200
                        return resolve(results)
                    } else {
                        code = 400
                        return resolve(undefined)
                    }
                })
            })
        }
        const deleteDCRes = await deleteDC()
        result = deleteDCRes
        code = 200
    } catch (error) {
        code = 400
        result = error instanceof Error ? error.message : "An Error has occurred"
    }
    const response = {
        statusCode: code,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST,DELETE"
        },
        body: JSON.stringify(result)
    }
    return response
}