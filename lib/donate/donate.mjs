import mysql from "mysql2"

// define OUTSIDE so it closes automatically
const pool = mysql.createPool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE,
})

export const handler = async (event) => {
  let result
  let code

  try {
    //validate donation center exists in the database
    
  }

  //TODO: 200 statment for all the items being correct
  //TOdo: 200 statement for some of the items being correct and some not
  //TODO: 400 statement for all the items or categories being incorrect
  //TODO: 400 missing fields generic
  //TODO: 400 donation rejected, generic



  const response = {
    statusCode: 200,
    body: JSON.stringify(result),
  }

  return response
}
