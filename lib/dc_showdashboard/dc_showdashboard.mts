import 'dotenv/config';
import mysql from 'mysql2'
import { resourceLimits } from 'worker_threads';

interface DatabaseDonationCenter {
    dc_name: string,
    dc_latitude: number,
    dc_longitude: number,
    dc_address: string,
    dc_city: string,
    dc_state: string,
    dc_zipcode: string,
    dc_id: string,
    orgo_id: string,
}
interface grandValue {
    dc_grandValue: number
}

interface grandNumber {
    dc_grandNumber: number
}

interface categoryNameItemVal {
    cat_name: string,
    cat_itemCount: number,
    cat_itemValue: number
}

export const handler = async (userId: string): Promise<DatabaseDonationCenter | any | undefined>  => {
  let code
  let result 

  var pool = mysql.createPool({
      host: 	process.env.RDS_HOST,
      user: 	process.env.RDS_USER,
      password: process.env.RDS_PASSWORD,
      database: process.env.RDS_DATABASE
  })

  try {
    const getDonationCenterLocInfo = () => {
      return new Promise((resolve, reject) => {
        const selectQuery = "SELECT * FROM DonationCenter WHERE dc_id = ?"
        pool.query(selectQuery, [userId], (error, results) => {
          //error is any potential error codes, results is an array, where each instance is a tuple
          if (error) { return reject(error)}
          if (Array.isArray(results) && results.length == 1){
            const dcInfo: DatabaseDonationCenter = results[0] as DatabaseDonationCenter
            return resolve({
              address:  dcInfo.dc_address,
              city:     dcInfo.dc_city,
              id:       dcInfo.dc_id,
              zipcode:  dcInfo.dc_zipcode,
              lat:      dcInfo.dc_latitude,
              long:     dcInfo.dc_longitude,
              name:     dcInfo.dc_name  
            })
          } else {
            return resolve(undefined)
          }
        })
      })
    }

    const getGrandNumItems = () => {
      return new Promise((resolve, reject) => {
        const selectQuery = "SELECT SUM(ItemInstance.inst_qty) FROM DonationCenter LEFT JOIN ItemInstance.dc_id on DonationCenter.dc_id = ItemInstance.dc_id WHERE DonationCenter.dc_id = ?"
        pool.query(selectQuery, [userId], (error, results) => {
          if(error){ return reject(error)}
          if(Array.isArray(results) && results.length == 1){ 
            const dcNumItems: grandNumber = results[0] as grandNumber
          } else {
            return resolve(undefined)
          }
        })
      })
    }

    const getGrandNumValues = () => {
      return new Promise((resolve, reject) => {
        const selectQuery = "SELECT SUM(ItemInstance.inst_value) FROM DonationCenter LEFT JOIN ItemInstance.dc_id ON DonationCenter.dc_id = ItemInstance.dc_id WHERE DonationCenter.dc_id = ?"
        pool.query(selectQuery, [userId], (error, results) => {
          if(error){ return reject(error)}
          if(Array.isArray(results) && results.length == 1){ 
            const dcNumItems: grandValue = results[0] as grandValue
          } else {
            return resolve(undefined)
          }
        })
      })
    }

    const getCategoriesItemsValue = () => {
      return new Promise((resolve, reject) => {
        const selectQuery = "SELECT Category.cat_name, SUM(ItemInstance.inst_value), SUM(ItemInstance.inst_qty) FROM DonationCenter JOIN DonationCenter, ItemInstance, Item, Category ON DonationCenter.dc_id = ItemInstance.dc_id, ItemInstance.item_id = Item.item_id, Item.cat_id = Category.cat_id WHERE DonationCenter.dc_id = ?"
        pool.query(selectQuery, [userId], (error,results) => {
          if(error){ return reject(error)}
          if(Array.isArray(results) && results.length >= 1){
            //const catItemVals: categoryNameItemVal = results as categoryNameItemVal
            return resolve(results || [])
          }
        })
      })
    }

    //const donationCenterInformaiton = await getDonationCenterLocInfo()
    const donationCenterItemQuantity = await getGrandNumItems()
    const donationCenterItemValue = await getGrandNumValues()
    const donationCenterCatItemsValue = await getCategoriesItemsValue()
    pool.end()

    result =  {
      grandItems: donationCenterItemQuantity,
      grandValue: donationCenterItemValue,
      categoryInfo: donationCenterCatItemsValue
    }
    code = 200


  } catch (error) {
    result = error instanceof Error ? error.message : "An unexpected error has occurred"
    code = 400
  }
  const response = {
    statusCode: code,
    body: JSON.stringify(result)
  }

  return response
}
