#![type_length_limit = "1195029"]

use std::time::Duration;

use lambda_runtime::lambda;
use log::{error,
          info};
use node_identifier::{handler,
                      init_dynamodb_client,
                      local_handler};
use rusoto_core::RusotoError;
use rusoto_dynamodb::DynamoDb;
use tokio::runtime::Runtime;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env = grapl_config::init_grapl_env!();

    if env.is_local {
        info!("Running locally");
        let mut runtime = Runtime::new().unwrap();

        let dynamodb_client = init_dynamodb_client();
        loop {
            if let Err(e) = runtime.block_on(dynamodb_client.describe_endpoints()) {
                match e {
                    RusotoError::HttpDispatch(_) => {
                        info!("Waiting for DynamoDB to become available");
                        std::thread::sleep(Duration::new(2, 0));
                    }
                    _ => break,
                }
            }
        }

        loop {
            if let Err(e) = runtime.block_on(async move { local_handler(true).await }) {
                error!("{}", e);
            }

            std::thread::sleep(Duration::new(2, 0));
        }
    } else {
        info!("Running in AWS");
        lambda!(handler);
    }
    Ok(())
}
