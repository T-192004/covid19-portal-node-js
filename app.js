const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
app.use(express.json())

let db = null
const initializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running at http://localhost:3000/')
    })
  } catch (error) {
    console.log(`Error: ${error.message}`)
    process.exit(1)
  }
}
initializeDBandServer()

////////////---------------API 1 ----------------------
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  console.log(request.body)
  const loginUserRequestQuery = ` 
  SELECT 
    * 
  FROM 
    user
  WHERE username = '${username}';
  `
  const dbUser = await db.get(loginUserRequestQuery)
  console.log(dbUser)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched) {
      const jwtToken = await jwt.sign(username, 'MY_SECRET_TOKEN')
      console.log(jwtToken)
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

////////----------------------VERIFY JWTOKEN ---------------
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        console.log({jwtToken})
        console.log({payload})
        request.username = payload
        next()
      }
    })
  }
}

//////------------------STATE DETAILS-------------
const getStateDeatils = dbObj => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  }
}

//// -----------------API 2 --------------------------

app.get('/states/', authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
  SELECT 
    *
  FROM
    state;
  `
  const allStatesArray = await db.all(getAllStatesQuery)
  response.send(allStatesArray.map(eachState => getStateDeatils(eachState)))
})

//// -----------------API 3 --------------------------

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  console.log(request)
  const getAllStatesQuery = `
  SELECT 
    *
  FROM
    state
  WHERE 
    state_id = ${stateId};
  `
  const stateDetailsResponse = await db.get(getAllStatesQuery)
  response.send(getStateDeatils(stateDetailsResponse))
})

///////----------API 4--------------------

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  console.log(request.body)
  const psostDistrictDetails = `
  INSERT INTO 
    district(district_name, state_id, cases, cured, active, deaths)
  VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
  `
  await db.run(psostDistrictDetails)
  response.send('District Successfully Added')
})

////////----------------GET DISTRICT DETAILS------------------

const getDistrictDetails = dbObj => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  }
}

///////---------------------API 5-----------------------------

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    console.log(districtId)
    const getDistrictQuery = `
  SELECT 
    *
  FROM
    district
  WHERE
    district_id = ${districtId};
  `
    const districtDetailsResponse = await db.get(getDistrictQuery)
    response.send(getDistrictDetails(districtDetailsResponse))
  },
)

//////////-----------------API 6-------------------

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
  DELETE FROM
    district
  WHERE 
    district_id = ${districtId};
  `
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

////////------------------------API 7 ------------------

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const {districtId} = request.params
    const putDistrictDetailsQuery = `
  UPDATE 
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
  WHERE
    district_id = ${districtId};
  `
    await db.run(putDistrictDetailsQuery)
    response.send('District Details Updated')
  },
)

/////////////--------GET STATS DETAILS---------------

const getStatsDetails = dbObj => {
  return {
    totalCases: dbObj.totalCases,
    totalCured: dbObj.totalCured,
    totalActive: dbObj.totalActive,
    totalDeaths: dbObj.totalDeaths,
  }
}

//////-----------------------API 8 -----------------------------

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatsQuery = `
  SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
  FROM
    district
  WHERE
    state_id = ${stateId};
  `
    const statsResponse = await db.get(getStatsQuery)
    response.send(getStatsDetails(statsResponse))
  },
)

module.exports = app
