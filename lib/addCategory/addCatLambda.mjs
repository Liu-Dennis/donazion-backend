import 'dotenv/config';
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE,
})

export const handler = async (event) => {
  const input = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? event)
  const { orgo_id, cat_name } = input;
  if (orgo_id === undefined || !cat_name) {
    return { statusCode: 400, body: JSON.stringify({ message: 'orgo_id and cat_name are required' }) }
  }
  let result
  try {
  const [duplicate] = await pool.query(
      'SELECT * FROM Category WHERE cat_name = ? AND orgo_id = ?', [cat_name, orgo_id]
    )
    console.log(duplicate.length)
    if (duplicate.length !== 0){
      return {
        statusCode: 400,
        body: JSON.stringify({
        message: 'Category name not unique' 
        }) 
      }
    }
  } catch (err) {
    console.log(err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Could not access database' 
        }) 
    }
  }
  try {
     [result] = await pool.query(
      'INSERT INTO Category (orgo_id, cat_name) VALUES (?, ?)',
      [orgo_id, cat_name]
    )
  } catch (err) {
    console.log(err)
    return { 
      statusCode: 400,
      body: JSON.stringify({
        message: 'Could not insert into database, malformed data' 
        }) 
    }
  }
  let rows
  try {
    [rows] = await pool.query(
      "SELECT * FROM calc.Category WHERE cat_name = ? ", [cat_name]
    )
  } catch (err) {
    console.log(err)
    return { 
      statusCode: 400,
      body: JSON.stringify({
      message: 'Could not find value' 
      }) 
    }
  }
    if (rows.length === 0) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ message: 'Could not locate category' })
      }
    }
    return { 
      statusCode: 200,
      headers:{
         "Access-Control-Allow-Origin": "http://localhost:3000/",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST"
      },
       body: JSON.stringify(rows[0]) 
    }
}