// Quick ERP: test, build and deploy on every push to the production branch.
pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    timeout(time: 45, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  triggers {
    // Checks GitHub for new commits every 2 minutes, so Jenkins can stay private.
    pollSCM('H/2 * * * *')
  }

  environment {
    JAVA_HOME = '/usr/lib/jvm/java-21-openjdk-amd64'
    COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
    CI = 'true'
  }

  stages {
    stage('Backend: tests and build') {
      environment {
        QUICKERP_TEST_DB_URL = credentials('quickerp-test-db-url')
      }
      steps {
        dir('backend') {
          sh 'chmod +x mvnw && ./mvnw -B clean package'
        }
      }
    }

    stage('Frontend: install') {
      steps {
        dir('frontend') {
          sh 'corepack pnpm install --frozen-lockfile'
        }
      }
    }

    stage('Frontend: checks') {
      steps {
        dir('frontend') {
          sh 'corepack pnpm run typecheck && corepack pnpm run lint && corepack pnpm run qa:all'
        }
      }
    }

    stage('Frontend: build') {
      environment {
        VITE_API_BASE_URL = '/api/v1'
        VITE_USE_MOCKS = 'false'
      }
      steps {
        dir('frontend') {
          sh 'corepack pnpm run build'
        }
      }
    }

    stage('Deploy') {
      steps {
        sh 'sudo /usr/local/bin/quickerp-deploy "$WORKSPACE/backend/target/quick-erp-backend.jar" "$WORKSPACE/frontend/dist"'
      }
    }
  }

  post {
    success { echo 'Quick ERP is updated.' }
    failure { echo 'Nothing new went live (or the previous version was restored). Open the failed stage to see why.' }
  }
}