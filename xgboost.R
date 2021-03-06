## xgboost classification

# See https://www.kaggle.com/tqchen/otto-group-product-classification-challenge/understanding-xgboost-model-on-otto-data/code

# names(train)
# [1] "TripType"              "VisitNumber"           "Weekday"              
# [4] "Upc"                   "ScanCount"             "DepartmentDescription"
# [7] "FinelineNumber"

library(dplyr)
library(magrittr)
library(reshape2)
library(xgboost)
library(Matrix)
library(Ckmeans.1d.dp)
library(DiagrammeR)
library(caret)
library(corrplot)
library(Rtsne)
library(stats)
library(ggplot2)
library(e1071)
library(data.table)

# also look into slam package for sparse matricies

time.start <- Sys.time()

# Read files
train.data <- read.csv("./input/train.csv", header = TRUE, stringsAsFactors = TRUE) %>% data.table()
test.data <- read.csv("./input/test.csv", header = TRUE, stringsAsFactors = TRUE) %>% data.table()

# train.data <- top_n(train.data, 1000)
# test.data <- top_n(test.data, 1000)

# Create outcomes for xgboost
outcomes <- data.table(TripType = sort(unique(train.data$TripType)))
outcomes$Index <- seq_along(outcomes$TripType) - 1

# Combine train and test
dt <- data.table(rbind(train.data, cbind(TripType = -1, test.data)))

## Preprocessing

# Convert NA values
# NA values are found in FinelineNumber and Upc. "NULL" string value is found in DepartmentDescription.
dt$FinelineNumber <- addNA(dt$FinelineNumber)
dt$Upc <- addNA(dt$Upc)
dt <- dt[, NullDescription:=ifelse (dt$DepartmentDescription == "NULL", 1, 0)]

## Feature engineering 
# Include ReturnCount column
dt$ReturnCount <- -dt$ScanCount
dt$ReturnCount[dt$ReturnCount < 0] <- 0
dt$ScanCount[dt$ScanCount < 0] <- 0
dt$ResultCount <- dt$ScanCount - dt$ReturnCount

# Calculate Scan and Return counts by VisitNumber
item.counts <- summarise(group_by(dt, VisitNumber),
                         TotalScan = sum(ScanCount), TotalReturn = sum(ReturnCount), TotalResult = sum(ResultCount))

# save.image("D:/Stats/Kaggle/walmart/xg1.RData")
load("xg1.RData")

# Convert dt data.frame from long to wide format using dcast from reshape2 package
# We want to aggregate on columns "TripType", "VisitNumber" and "Weekday" 
dt.long <- melt.data.table(data = dt, measure.vars = c("ScanCount", "ReturnCount", "ResultCount"),
                           variable.name = "ItemCount")

dt.wide1 <- dcast.data.table(data = dt.long,
                 VisitNumber + TripType + Weekday ~ DepartmentDescription + ItemCount,
                 value.var = "value",
                 fun.aggregate = sum) # %>% arrange(VisitNumber)
  


# Memory issues with the below
# dt.wide1 <- dcast.data.table(data = dt,
#                              VisitNumber + TripType + Weekday ~ FinelineNumber,
#                              value.var = "ResultCount",
#                              fun.aggregate = sum) %>% arrange(VisitNumber)
# 

wd <- model.matrix(~0 + Weekday, data = dt.wide1)

dt.wide1 <- cbind(wd, dt.wide1)
dt.wide1 <- dt.wide1[, Weekday:=NULL]

# all.equal(dt.wide1$VisitNumber, dt.wide2$VisitNumber)
# dt.wide <- merge(dt.wide1, dt.wide2, by = "VisitNumber")

dt.wide <- dt.wide1

rm(dt.wide1)
# rm(dt.wide2)

dt.wide <- merge(dt.wide, item.counts, by = "VisitNumber")

# Split train and test 
train <- dt.wide[dt.wide$TripType != -1, ]
test <- dt.wide[dt.wide$TripType == -1, ]

train <- train[, VisitNumber := NULL] # preferred way of deleting data.table columns
test.VisitNumber <- test$VisitNumber
test <- test[, VisitNumber :=  NULL]


# # correlation matrix
# corrplot.mixed(cor(train), lower="circle", upper="color", 
#                tl.pos="lt", diag="n", order="hclust", hclust.method="complete")

# ## tsne plot
# # t-Distributed Stochastic Neighbor Embedding
# tsne = Rtsne(as.matrix(train), check_duplicates=FALSE, pca=TRUE, 
#              perplexity=30, theta=0.5, dims=2)
# 
# embedding = as.data.frame(tsne$Y)
# embedding$Class = outcome.org
# 
# g = ggplot(embedding, aes(x=V1, y=V2, color=Class)) +
#   geom_point(size=1.25) +
#   guides(colour=guide_legend(override.aes=list(size=6))) +
#   xlab("") + ylab("") +
#   ggtitle("t-SNE 2D Embedding of 'Classe' Outcome") +
#   theme_light(base_size=20) +
#   theme(axis.text.x=element_blank(),
#         axis.text.y=element_blank())
# 
# print(g)

# train.wide2 <- dcast(data = train.long, VisitNumber ~ FinelineNumber)
# train.wide3 <- dcast(data = train.long, VisitNumber ~ Upc)
# 
# train.wide <- merge(train.wide1, train.wide2, by = "VisitNumber")
# train.wide <- merge(train.wide, train.wide3, by = "VisitNumber")

## xgboost
y <- plyr::mapvalues(train$TripType, from = outcomes$TripType, to = outcomes$Index)

train <- train[, TripType := NULL]
test <- test[, TripType := NULL]

num.class <- length(unique(y))

# xgboost parameters
param <- list("objective" = "multi:softprob",    # multiclass classification 
              "num_class" = num.class,    # number of classes 
              "eval_metric" = "mlogloss",    # evaluation metric 
              "nthread" = 8,   # number of threads to be used 
              "max_depth" = 16,    # maximum depth of tree 
              "eta" = 0.3,    # step size shrinkage 
              "gamma" = 0,    # minimum loss reduction 
              "subsample" = 1,    # part of data instances to grow tree 
              "colsample_bytree" = 1,  # subsample ratio of columns when constructing each tree 
              "min_child_weight" = 12  # minimum sum of instance weight needed in a child 
)

train.matrix <- as.matrix(train)
train.matrix <- as(train.matrix, "dgCMatrix") # conversion to sparse matrix
dtrain <- xgb.DMatrix(data = train.matrix, label = y)

## cv
set.seed(1234)

cv.nround <- 50 # 200
cv.nfold <- 3 # 10

bst.cv <- xgb.cv(param=param, data=dtrain, 
                              nfold=cv.nfold, nrounds=cv.nround, prediction=TRUE) 

tail(bst.cv$dt)

# Index of minimum merror
min.error.index = which.min(bst.cv$dt[, test.mlogloss.mean]) 
min.error.index 

# Minimum error
bst.cv$dt[min.error.index, ]

## Confusion matrix - needs checking
# cv prediction decoding
# pred.cv = matrix(bst.cv$pred, nrow=length(bst.cv$pred)/num.class, ncol=num.class)
# pred.cv = max.col(pred.cv, "last")

# Confusion matrix
# confusionMatrix(factor(pred.cv), factor(y + 1))

## Model
nround = min.error.index # number of trees generated
bst <- xgboost(param = param, data = dtrain, nrounds = nround, verbose = TRUE)

model <- xgb.dump(bst, with.stats = T)
model[1:10]

# Get the feature real names
names <- dimnames(train.matrix)[[2]]

# Compute feature importance matrix
importance_matrix <- xgb.importance(names, model = bst)

# Nice graph
xgb.plot.importance(importance_matrix[1:20,])

# Tree plot - not working
# xgb.plot.tree(feature_names = names, model = bst, n_first_tree = 2)

## Prediction
test.matrix <- as.matrix(test)
pred <- predict(bst, test.matrix)

# Decode prediction
pred <- matrix(pred, nrow=num.class, ncol=length(pred) / num.class)
pred <- data.frame(cbind(test.VisitNumber, t(pred)))

# output
submit <- function(filename) {
  names(pred) <- c("VisitNumber", paste("TripType", outcomes$TripType, sep = "_")) 
  
  write.table(format(pred, scientific = FALSE), paste("./output/", filename, sep = ""), row.names = FALSE, sep = ",")
}
submit("xgboost11.csv")

time.end <- Sys.time()
time.end - time.start

# http://api.walmartlabs.com/v1/items?format=json&apiKey=xkk84gntx74t2bmjx6gmgqcr&upc=078257317042
 
# ## Naive Bayes
# model <- naiveBayes(train, y)   
# pred <- predict(model, test)  
# 
# 
# table <- as.data.frame(rbind(as.matrix(table),as.matrix(table)))
# 
# nms <- colnames(table)
# model <- naiveBayes(table[,1:length(nms)-1], factor(table[,length(nms)]))
# predict(model, table[,1:(length(nms)-1)], type='raw')


## Caret
set.seed(1234)

library(mlbench)
library(caret)

# check for zero variances
zero.var = nearZeroVar(train, saveMetrics=TRUE)
# zero.var
# zero.var[zero.var$zeroVar == TRUE, ]
# zero.var[zero.var$nzv == FALSE, ]

cols <- row.names(zero.var[zero.var$nzv == TRUE, ]) # columns to discard
colNums <- match(cols, names(train))
ntrain <- select(train, -colNums)

corr <- cor(ntrain)
corr

model <- naiveBayes(ntrain, y)   
pred <- predict(model, test)  


# Decode prediction
pred <- matrix(pred, nrow=num.class, ncol=length(pred) / num.class)
pred <- data.frame(cbind(test.VisitNumber, t(pred)))
