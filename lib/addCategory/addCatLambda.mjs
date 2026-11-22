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
    return { statusCode: 400, body: JSON.stringify({ message: 'orgoid and cat_name are required' }) }
  }
  let result
  try {
     [result] = await pool.query(
      'INSERT IGNORE INTO Category (orgo_id, cat_name) VALUES (?, ?)',
      [orgo_id, cat_name]
    )
  } catch (err) {
    console.log(err)
    return { 
      statusCode: 400,
      body: JSON.stringify({
        message: 'Could not insert into database, category could already exist' 
        }) 
    }
  }
  let rows
  try {
    [rows] = result.insertId
      ? await pool.query('SELECT * FROM Category WHERE cat_id = ?', [result.insertId])
      : await pool.query('SELECT * FROM Category WHERE orgo_id = ? AND cat_name = ?', [orgo_id, cat_name])
  } catch (err) {
    console.log(err)
    return { 
      statusCode: 400,
      body: JSON.stringify({
      message: 'Could not find value, insert could have failed' 
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
       body: JSON.stringify(rows[0]) 
    }
}