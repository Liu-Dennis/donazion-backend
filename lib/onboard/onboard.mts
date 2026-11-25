import mysql, { Pool } from "mysql2"
import { UserDonationCenter } from "../shared/Types.js"
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"

const isOrg = async (id: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM calc.Organization WHERE orgo_user = ?",
      [id],
      (err, rows) => {
        if (err) {
          reject(err)
        }
        if (rows) {
          resolve(false)
        } else {
          resolve(true)
        }
      },
    )
  })
}

const isOnboarded = async (id: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM calc.DonationCenter WHERE dc_id = ?",
      [id],
      (err, rows) => {
        if (err) {
          reject(err)
        }
        if (Array.isArray(rows) && rows.length > 0) {
          resolve(true)
        } else {
          resolve(false)
        }
      },
    )
  })
}

const validateJSON = (obj: unknown): obj is UserDonationCenter => {
  if (typeof obj !== "object" || obj === null) return false
  const data = obj as Record<string, unknown>

  return (
    typeof data.name === "string" &&
    typeof data.address === "string" &&
    typeof data.city === "string" &&
    typeof data.state === "string" &&
    typeof data.zipcode === "string" &&
    typeof data.lat === "number" &&
    typeof data.long === "number"
  )
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
}

export const pool: Pool = mysql.createPool({
  host: process.env.RDS_HOST!,
  user: process.env.RDS_USER!,
  password: process.env.RDS_PASSWORD!,
  database: process.env.RDS_DATABASE!,
})

// check if user is a org, if so deny else create db entry
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  // This is behind auth, this should never fail
  const reqId: string = event.requestContext.authorizer!.claims.sub
  const orgStatus: boolean = await isOrg(reqId)
  const onboardStatus: boolean = await isOnboarded(reqId)
  let body: UserDonationCenter

  try {
    if (event.body) {
      body = JSON.parse(event.body)
    } else {
      throw new Error("Error parsing body")
    }
  } catch (error) {
    console.log(JSON.stringify(error, null, 2))
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Invalid Body" }),
    }
  }

  if (!validateJSON(body)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Body missing fields" }),
    }
  }

  if (orgStatus || onboardStatus) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "User not eligible" }),
    }
  }

  // console.log(JSON.stringify(event, null, 2))

  try {
    await new Promise<void>((resolve, reject) => {
      pool.query(
        `INSERT INTO DonationCenter 
        (dc_id, orgo_id, dc_name, dc_address, dc_city, dc_state, dc_zipcode, dc_latitude, dc_longitude)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          reqId,
          "0",
          body.name,
          body.address,
          body.city,
          body.state,
          body.zipcode,
          body.lat,
          body.long,
        ],
        (err) => (err ? reject(err) : resolve()),
      )
    })
  } catch (error) {
    console.log(JSON.stringify(error, null, 2))
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Database error" }),
    }
  }
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ message: "Donation Center added successfully" }),
  }
}
